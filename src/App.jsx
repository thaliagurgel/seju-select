import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── CONSTANTES ──────────────────────────────────────────────────────────────
const COMMS = {
  tecnica:    { name:"Técnica",             vagas:11, color:"#4338CA", light:"#EEF2FF", text:"#3730a3" },
  logistica:  { name:"Logística",           vagas:7,  color:"#047857", light:"#ECFDF5", text:"#065f46" },
  midia:      { name:"Mídia e Comunicação", vagas:4,  color:"#BE185D", light:"#FDF2F8", text:"#9d174d" },
  cerimonial: { name:"Cerimonial",          vagas:6,  color:"#B45309", light:"#FFFBEB", text:"#92400e" },
  ti:         { name:"TI",                  vagas:3,  color:"#6D28D9", light:"#F5F3FF", text:"#5b21b6" },
};

const CRIT = [
  { id:"comunicacao",  label:"Comunicação"           },
  { id:"proatividade", label:"Proatividade"           },
  { id:"organizacao",  label:"Organização"            },
  { id:"equipe",       label:"Trabalho em equipe"     },
  { id:"disponib",     label:"Disponibilidade"        },
  { id:"compromet",    label:"Comprometimento"        },
  { id:"experiencia",  label:"Experiência prévia"     },
  { id:"compat",       label:"Compat. com a comissão" },
  { id:"criatividade", label:"Criatividade"           },
  { id:"tecnico",      label:"Conhecimento técnico"   },
];

const W = {
  tecnica:    [1.5,1.5,2,1,1,2,1.5,2,0.5,1  ],
  logistica:  [1,  1.5,1.5,2,2,1.5,1,2,0.5,2],
  midia:      [2,  1.5,1,1,1,1,1.5,2,2,1.5  ],
  cerimonial: [2,  1,1.5,1,1.5,1.5,1,2,0.5,0.5],
  ti:         [1,  1,1,1,1.5,1.5,1.5,2,0.5,2],
};

const STATUSES = [
  { id:"pendente",        label:"Pendente"        },
  { id:"entrevistado",    label:"Entrevistado"     },
  { id:"selecionado",     label:"Selecionado ✅"   },
  { id:"suplente",        label:"Suplente 🟡"      },
  { id:"remanejar",       label:"Remanejar 🔄"     },
  { id:"nao_selecionado", label:"Não selecionado ❌"},
  { id:"descartado",      label:"Descartado"       },
];

// ─── UTILS ───────────────────────────────────────────────────────────────────
const norm = s => (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");

function wScore(sc, ck){
  if(!sc||!ck||!W[ck]) return 0;
  const w=W[ck]; let tot=0, ws=0;
  CRIT.forEach((c,i)=>{ const v=Number(sc[c.id]??0); tot+=v*w[i]; ws+=w[i]; });
  return ws>0 ? parseFloat((tot/ws).toFixed(2)) : 0;
}

// Média simples entre todos os avaliadores
function avgScore(evals, candidateId, ck){
  const evs=evals.filter(e=>e.candidate_id===candidateId && e.scores);
  if(!evs.length) return null;
  const scores=evs.map(e=>wScore(e.scores, ck||e.commission_evaluated));
  return parseFloat((scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(2));
}

function mapComm(val){
  const n=norm(val).replace(/[^a-z0-9 ]/g," ");
  if(n.includes("logistic")) return "logistica";
  if(n.includes("midia")||n.includes("comunicac")) return "midia";
  if(n.includes("cerimonial")||n.includes("ceremonial")) return "cerimonial";
  if(/\bti\b/.test(n)||n.includes("tecnologia da informacao")) return "ti";
  return "tecnica";
}

// ─── CSV PARSER ──────────────────────────────────────────────────────────────
function parseCSVRows(txt, sep){
  const rows=[]; let row=[], cur="", inQ=false;
  for(let i=0;i<txt.length;i++){
    const c=txt[i];
    if(c==='"'){ if(inQ&&txt[i+1]==='"'){cur+='"';i++;} else inQ=!inQ; }
    else if(c===sep&&!inQ){ row.push(cur.trim()); cur=""; }
    else if((c==='\n'||c==='\r')&&!inQ){
      if(c==='\r'&&txt[i+1]==='\n') i++;
      row.push(cur.trim());
      if(row.some(x=>x)) rows.push(row);
      row=[]; cur="";
    } else cur+=c;
  }
  row.push(cur.trim());
  if(row.some(x=>x)) rows.push(row);
  return rows;
}

function parseCSV(txt){
  txt=txt.replace(/^\uFEFF/,"");
  const sep=txt.split("\n")[0].includes(";")?";":","
  const rows=parseCSVRows(txt,sep);
  if(rows.length<2) return [];
  const hdrs=rows[0].map(h=>h.replace(/^"|"$/g,"").replace(/:+$/,"").trim());
  const fn=(kws)=>hdrs.findIndex(h=>kws.every(k=>norm(h).includes(k)));
  const iName=fn(["nome","completo"]), iEmail=fn(["e-mail"])!==-1?fn(["e-mail"]):fn(["email"]);
  const iPhone=fn(["telefone"]), iPeriod=fn(["periodo"]), iComm=fn(["comissao","seju"]);
  const iAvail=fn(["disponibilidade"]), iExp=fn(["participou","evento"]);
  const iExtra=fn(["extracurricular"]), iText=fn(["elabore"]);
  const iMatric=fn(["matricula"]), iBirth=fn(["nascimento"]), iCPF=fn(["cpf"]), iRoutine=fn(["rotina"]);
  const seen=new Set();
  return rows.slice(1).map(v=>{
    const get=i=>i>=0?(v[i]||"").replace(/^"|"$/g,"").trim():"";
    const name=get(iName); if(!name) return null;
    const key=norm(name)+get(iEmail);
    if(seen.has(key)) return null; seen.add(key);
    return {
      name, email:get(iEmail), phone:get(iPhone), period:get(iPeriod),
      commission1:mapComm(get(iComm)), commission_raw:get(iComm),
      availability:get(iAvail), skills:get(iExtra).slice(0,400),
      notes:get(iText).slice(0,600), matricula:get(iMatric),
      birthdate:get(iBirth), cpf:get(iCPF), event_exp:get(iExp).slice(0,400),
      routine:get(iRoutine).slice(0,400),
    };
  }).filter(Boolean);
}

// ─── CSV EXPORT ──────────────────────────────────────────────────────────────
function dlCSV(candidates, evaluations, finalStatuses){
  const rows=[["Nome","Matrícula","Período","Email","Comissão","Nota Média","Nº Avaliadores","Status Final","Observações Consolidadas"]];
  candidates.forEach(c=>{
    const ck=c.commission1;
    const avg=avgScore(evaluations,c.id,ck);
    const fs=finalStatuses.find(f=>f.candidate_id===c.id);
    const obs=evaluations.filter(e=>e.candidate_id===c.id&&e.observations)
      .map(e=>`[${e.evaluator_name}] ${e.observations}`).join(" | ");
    const nEval=evaluations.filter(e=>e.candidate_id===c.id&&e.scores).length;
    rows.push([c.name,c.matricula||"",c.period||"",c.email||"",
      COMMS[ck]?.name||"",avg??"",(nEval||""),
      STATUSES.find(s=>s.id===(fs?.status||"pendente"))?.label||"",
      obs.replace(/"/g,"'")
    ].map(x=>`"${x}"`).join(","));
  });
  const blob=new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv;charset=utf-8;"});
  const a=Object.assign(document.createElement("a"),{href:URL.createObjectURL(blob),download:"SEJU_Select_Resultados.csv"});
  a.click();
}

// ─── ESTILOS BASE ─────────────────────────────────────────────────────────────
const S = {
  page:  { padding:24, maxWidth:760 },
  card:  { background:"#fff", borderRadius:14, border:"1px solid #f3f4f6", padding:16, marginBottom:12 },
  label: { fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:4 },
  input: { width:"100%", border:"1px solid #e5e7eb", borderRadius:10, padding:"9px 12px", fontSize:13, background:"#f9fafb", boxSizing:"border-box" },
  btn:   { border:"none", borderRadius:10, padding:"9px 18px", fontSize:13, fontWeight:600, cursor:"pointer" },
};

function CommBadge({ck}){
  const c=COMMS[ck]; if(!c) return null;
  return <span style={{background:c.light,color:c.text,padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700}}>{c.name}</span>;
}
function SBadge({status}){
  const map={pendente:["#f3f4f6","#6b7280"],entrevistado:["#dbeafe","#1d4ed8"],selecionado:["#dcfce7","#15803d"],
    suplente:["#fef3c7","#b45309"],remanejar:["#e0e7ff","#4338ca"],nao_selecionado:["#fee2e2","#dc2626"],descartado:["#f3f4f6","#9ca3af"]};
  const [bg,tc]=map[status]||map.pendente;
  const label=STATUSES.find(s=>s.id===status)?.label||"Pendente";
  return <span style={{background:bg,color:tc,padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:600}}>{label}</span>;
}
function ScoreBar({value}){
  const col=value>=7?"#16a34a":value>=5?"#ca8a04":"#dc2626";
  return(
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <div style={{flex:1,height:4,background:"#e5e7eb",borderRadius:9}}>
        <div style={{width:`${(value/10)*100}%`,height:"100%",background:col,borderRadius:9}}/>
      </div>
      <span style={{fontSize:11,color:"#6b7280",minWidth:18,textAlign:"right"}}>{value}</span>
    </div>
  );
}
function Toast({msg}){
  if(!msg) return null;
  return <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#1f2937",color:"#fff",padding:"10px 22px",borderRadius:12,fontSize:13,fontWeight:500,zIndex:9999,boxShadow:"0 4px 20px rgba(0,0,0,0.2)"}}>{msg}</div>;
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({onLogin}){
  const [email,setEmail]=useState("thalia@seju.com");
  const [pwd,setPwd]=useState("seju2025");
  const [err,setErr]=useState(""); const [loading,setLoading]=useState(false);
  const go=async()=>{
    setLoading(true); setErr("");
    const {data,error}=await supabase.from("users").select("*").eq("email",email).eq("password",pwd).single();
    setLoading(false);
    if(error||!data) setErr("Email ou senha incorretos.");
    else onLogin(data);
  };
  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#1e1b4b,#4c1d95)"}}>
      <div style={{background:"#fff",borderRadius:20,padding:"2rem",width:"100%",maxWidth:360,boxShadow:"0 20px 40px rgba(0,0,0,0.2)"}}>
        <div style={{textAlign:"center",marginBottom:"2rem"}}>
          <div style={{width:56,height:56,borderRadius:14,background:"#1e1b4b",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto 12px"}}>⚖️</div>
          <h1 style={{fontSize:22,fontWeight:700,color:"#1e1b4b",margin:0}}>SEJU Select</h1>
          <p style={{fontSize:13,color:"#9ca3af",margin:"4px 0 0"}}>Sistema de Seleção · V SEJU 2026.1</p>
        </div>
        {[{l:"Email",v:email,s:setEmail,t:"email"},{l:"Senha",v:pwd,s:setPwd,t:"password"}].map(x=>(
          <div key={x.l} style={{marginBottom:12}}>
            <label style={S.label}>{x.l}</label>
            <input type={x.t} value={x.v} onChange={e=>x.s(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} style={S.input}/>
          </div>
        ))}
        {err&&<p style={{color:"#ef4444",fontSize:13,background:"#fef2f2",padding:"8px 12px",borderRadius:8,marginBottom:12}}>{err}</p>}
        <button onClick={go} disabled={loading} style={{...S.btn,width:"100%",background:"#3730a3",color:"#fff"}}>
          {loading?"Entrando...":"Entrar"}
        </button>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({candidates,evaluations,finalStatuses}){
  const total=candidates.length;
  const evaled=new Set(evaluations.map(e=>e.candidate_id)).size;
  const selected=finalStatuses.filter(f=>f.status==="selecionado").length;
  const byComm=useMemo(()=>Object.entries(COMMS).map(([k,c])=>{
    const inC=candidates.filter(x=>x.commission1===k);
    const sel=finalStatuses.filter(f=>{const cd=candidates.find(x=>x.id===f.candidate_id);return cd?.commission1===k&&f.status==="selecionado";}).length;
    const sup=finalStatuses.filter(f=>{const cd=candidates.find(x=>x.id===f.candidate_id);return cd?.commission1===k&&f.status==="suplente";}).length;
    const entrev=new Set(evaluations.filter(e=>inC.some(x=>x.id===e.candidate_id)).map(e=>e.candidate_id)).size;
    return{k,c,total:inC.length,entrev,sel,sup};
  }),[candidates,evaluations,finalStatuses]);
  return(
    <div style={S.page}>
      <h2 style={{fontSize:22,fontWeight:700,color:"#1f2937",margin:"0 0 4px"}}>Dashboard</h2>
      <p style={{fontSize:13,color:"#9ca3af",marginBottom:20}}>V SEJU 2026.1 · Dados em tempo real</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
        {[{icon:"👥",v:total,l:"Inscritos",bg:"#eff6ff",tc:"#1d4ed8"},{icon:"🎤",v:evaled,l:"Com avaliação",bg:"#f0fdf4",tc:"#15803d"},{icon:"⏳",v:total-evaled,l:"Pendentes",bg:"#fff7ed",tc:"#c2410c"},{icon:"✅",v:selected,l:"Selecionados",bg:"#f0fdf4",tc:"#15803d"}].map(s=>(
          <div key={s.l} style={{background:s.bg,borderRadius:14,padding:16}}>
            <div style={{fontSize:20,marginBottom:4}}>{s.icon}</div>
            <div style={{fontSize:28,fontWeight:900,color:s.tc}}>{s.v}</div>
            <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{s.l}</div>
          </div>
        ))}
      </div>
      {byComm.map(({k,c,total,entrev,sel,sup})=>(
        <div key={k} style={S.card}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}><CommBadge ck={k}/><span style={{fontSize:12,color:"#9ca3af"}}>{total} inscrito{total!==1?"s":""}</span></div>
            <span style={{fontSize:14,fontWeight:700,color:"#374151"}}>{sel}<span style={{fontWeight:400,color:"#9ca3af"}}>/{c.vagas} vagas</span></span>
          </div>
          <div style={{background:"#f3f4f6",borderRadius:99,height:6,marginBottom:8}}>
            <div style={{width:`${Math.min(100,c.vagas>0?Math.round((sel/c.vagas)*100):0)}%`,height:6,borderRadius:99,background:c.color}}/>
          </div>
          <div style={{display:"flex",gap:16,fontSize:11,color:"#9ca3af"}}>
            <span>🎤 {entrev} com avaliação</span><span>🟡 {sup} suplentes</span><span>⏳ {total-entrev} pendentes</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── CANDIDATOS ───────────────────────────────────────────────────────────────
function CandidatesList({candidates,evaluations,finalStatuses,me,onAdd,onEval,onImport,onDiscard}){
  const [search,setSearch]=useState("");
  const byComm=useMemo(()=>Object.entries(COMMS).map(([k,c])=>{
    const q=norm(search);
    const list=candidates.filter(x=>x.commission1===k&&(norm(x.name).includes(q)||norm(x.period||"").includes(q)||q===""));
    return{k,c,list};
  }),[candidates,search]);
  return(
    <div style={S.page}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div><h2 style={{fontSize:22,fontWeight:700,color:"#1f2937",margin:"0 0 2px"}}>Candidatos</h2>
          <p style={{fontSize:13,color:"#9ca3af",margin:0}}>{candidates.length} inscrito{candidates.length!==1?"s":""}</p></div>
        <div style={{display:"flex",gap:8}}>
          {me.is_admin&&(
            <label style={{cursor:"pointer",background:"#f3f4f6",color:"#374151",border:"none",borderRadius:10,padding:"8px 14px",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:6}}>
              📥 Importar CSV
              <input type="file" accept=".csv,.txt" style={{display:"none"}} onChange={e=>{
                const f=e.target.files[0]; if(!f) return;
                const r=new FileReader(); r.onload=ev=>onImport(ev.target.result); r.readAsText(f,"UTF-8"); e.target.value="";
              }}/>
            </label>
          )}
          {me.is_admin&&<button onClick={onAdd} style={{...S.btn,background:"#3730a3",color:"#fff"}}>+ Novo</button>}
        </div>
      </div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome ou período..."
        style={{...S.input,marginBottom:20}}/>
      {candidates.length===0&&(
        <div style={{textAlign:"center",padding:"60px 0",color:"#d1d5db"}}>
          <div style={{fontSize:48,marginBottom:12}}>📭</div>
          <p>Nenhum candidato ainda.</p>
        </div>
      )}
      {byComm.map(({k,c,list})=>{
        if(!list.length) return null;
        return(
          <div key={k} style={{marginBottom:24}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,paddingBottom:8,borderBottom:`2px solid ${c.color}`}}>
              <CommBadge ck={k}/>
              <span style={{fontSize:12,color:"#9ca3af"}}>{list.length} candidato{list.length!==1?"s":""} · {c.vagas} vagas</span>
            </div>
            {list.map(cd=>{
              const myEval=evaluations.find(e=>e.candidate_id===cd.id&&e.evaluator_id===me.id);
              const allEvals=evaluations.filter(e=>e.candidate_id===cd.id&&e.scores);
              const fs=finalStatuses.find(f=>f.candidate_id===cd.id);
              const avg=avgScore(evaluations,cd.id,cd.commission1);
              const st=fs?.status||"pendente";
              return(
                <div key={cd.id} style={{...S.card,display:"flex",alignItems:"center",gap:12,opacity:st==="descartado"?0.6:1}}>
                  <div style={{width:36,height:36,borderRadius:10,background:c.light,color:c.text,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,flexShrink:0}}>
                    {cd.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,color:"#1f2937",fontSize:14}}>{cd.name}</div>
                    <div style={{fontSize:11,color:"#9ca3af",marginTop:1}}>
                      {cd.period||"—"}{cd.matricula?` · Mat. ${cd.matricula}`:""}
                    </div>
                    {allEvals.length>0&&(
                      <div style={{fontSize:11,color:"#6b7280",marginTop:3}}>
                        🎤 {allEvals.length} avaliação{allEvals.length!==1?"ões":""} · média{" "}
                        <strong style={{color:"#4338ca"}}>{avg}</strong>
                      </div>
                    )}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                    <SBadge status={st}/>
                    {st!=="descartado"&&(
                      <>
                        {me.is_admin&&st==="pendente"&&(
                          <button onClick={()=>onDiscard(cd.id)} style={{...S.btn,padding:"5px 10px",background:"#fff",color:"#ef4444",border:"1px solid #fecaca",fontWeight:500}}>Descartar</button>
                        )}
                        <button onClick={()=>onEval(cd)} style={{...S.btn,padding:"6px 14px",background:myEval?.scores?"#f0fdf4":"#3730a3",color:myEval?.scores?"#15803d":"#fff",border:myEval?.scores?"1px solid #bbf7d0":"none",whiteSpace:"nowrap"}}>
                          {myEval?.scores?"Editar minha nota":"Avaliar"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── FORMULÁRIO DE AVALIAÇÃO ──────────────────────────────────────────────────
function EvaluateForm({candidate,myEval,me,allEvals,onSave,onBack}){
  const [scores,setScores]=useState(myEval?.scores||{});
  const [obs,setObs]=useState(myEval?.observations||"");
  const [ck,setCk]=useState(myEval?.commission_evaluated||candidate.commission1);
  const [saving,setSaving]=useState(false);
  const setS=(id,v)=>setScores(p=>({...p,[id]:Math.max(0,Math.min(10,Number(v)))}));
  const myScore=useMemo(()=>wScore(scores,ck),[scores,ck]);
  const avgAll=useMemo(()=>avgScore(allEvals,candidate.id,ck),[allEvals,candidate.id,ck]);
  const w=W[ck]||W.tecnica;
  const comm=COMMS[ck];
  const lbl=myScore>=8?"Excelente 🌟":myScore>=6.5?"Bom ✅":myScore>=5?"Regular ⚠️":myScore>0?"Baixo ⚡":"—";
  return(
    <div style={{padding:24,maxWidth:680}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:13}}>← Candidatos</button>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:"#1f2937",margin:"0 0 2px"}}>{candidate.name}</h2>
          <p style={{fontSize:12,color:"#9ca3af",margin:0}}>Avaliação de <strong>{me.name}</strong></p>
        </div>
      </div>

      {/* Dados do candidato */}
      <div style={{background:comm.light,borderRadius:14,padding:14,marginBottom:14}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:10}}>
          {[{l:"Período/Turno",v:candidate.period},{l:"Matrícula",v:candidate.matricula},{l:"Disponibilidade",v:candidate.availability},{l:"Data de nascimento",v:candidate.birthdate},{l:"CPF",v:candidate.cpf},{l:"Telefone",v:candidate.phone}].filter(x=>x.v).map(x=>(
            <div key={x.l}>
              <div style={{fontSize:10,color:"#9ca3af",textTransform:"uppercase",letterSpacing:1}}>{x.l}</div>
              <div style={{fontSize:12,fontWeight:500,color:"#374151",marginTop:2}}>{x.v}</div>
            </div>
          ))}
        </div>
        {[{l:"Experiência em eventos",v:candidate.event_exp},{l:"Atividades extracurriculares",v:candidate.skills},{l:"Rotina semanal",v:candidate.routine},{l:"Texto motivacional",v:candidate.notes}].filter(x=>x.v).map(x=>(
          <div key={x.l} style={{paddingTop:10,borderTop:`1px solid ${comm.color}22`,marginTop:8}}>
            <div style={{fontSize:10,color:"#9ca3af",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{x.l}</div>
            <div style={{fontSize:12,color:"#374151",lineHeight:1.6,maxHeight:80,overflowY:"auto"}}>{x.v}</div>
          </div>
        ))}
      </div>

      {/* Avaliações de outros avaliadores */}
      {allEvals.filter(e=>e.evaluator_id!==me.id&&e.scores).length>0&&(
        <div style={{...S.card,marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:600,color:"#374151",marginBottom:10}}>
            Avaliações dos colegas
            {avgAll!==null&&<span style={{marginLeft:8,fontSize:12,color:"#6b7280"}}>· Média geral: <strong style={{color:"#4338ca"}}>{avgAll}</strong></span>}
          </div>
          {allEvals.filter(e=>e.evaluator_id!==me.id&&e.scores).map(e=>(
            <div key={e.id} style={{borderTop:"1px solid #f3f4f6",paddingTop:10,marginTop:10}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:12,fontWeight:600,color:"#374151"}}>👤 {e.evaluator_name}</span>
                <span style={{fontSize:15,fontWeight:900,color:"#4338ca"}}>{wScore(e.scores,e.commission_evaluated||ck).toFixed(2)}</span>
              </div>
              {e.observations&&<p style={{fontSize:11,color:"#6b7280",fontStyle:"italic",margin:0}}>"{e.observations}"</p>}
            </div>
          ))}
        </div>
      )}

      {/* Critérios */}
      <div style={{...S.card,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:13,fontWeight:600,color:"#374151"}}>Avaliando para:</span>
            <select value={ck} onChange={e=>setCk(e.target.value)} style={{border:"1px solid #e5e7eb",borderRadius:8,padding:"5px 8px",fontSize:13,background:"#f9fafb"}}>
              {Object.entries(COMMS).map(([k,c])=><option key={k} value={k}>{c.name}</option>)}
            </select>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:28,fontWeight:900,color:"#4338ca"}}>{myScore.toFixed(2)}</div>
            <div style={{fontSize:11,color:"#9ca3af"}}>{lbl}</div>
          </div>
        </div>
        {CRIT.map((c,i)=>{
          const wt=w[i]; const hi=wt>=2; const val=scores[c.id]??0;
          return(
            <div key={c.id} style={{padding:10,borderRadius:10,background:hi?"#f5f3ff":"transparent",border:hi?"1px solid #e0e7ff":"none",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:13,color:"#374151"}}>{c.label}</span>
                  {hi&&<span style={{fontSize:10,background:"#ddd6fe",color:"#5b21b6",padding:"2px 6px",borderRadius:99,fontWeight:600}}>Peso {wt}×</span>}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <input type="range" min="0" max="10" step="1" value={val} onChange={e=>setS(c.id,e.target.value)} style={{width:80,accentColor:"#4338ca"}}/>
                  <input type="number" min="0" max="10" value={val} onChange={e=>setS(c.id,e.target.value)} style={{width:42,border:"1px solid #e5e7eb",borderRadius:8,textAlign:"center",fontSize:13,padding:"3px 0",background:"#f9fafb"}}/>
                </div>
              </div>
              <ScoreBar value={val}/>
            </div>
          );
        })}
      </div>

      {/* Observações */}
      <div style={{...S.card,marginBottom:20}}>
        <label style={S.label}>Minhas observações</label>
        <textarea rows={3} value={obs} onChange={e=>setObs(e.target.value)}
          placeholder="Pontos fortes, fracos, comportamento, adequação ao perfil..."
          style={{...S.input,resize:"none"}}/>
      </div>

      <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
        <button onClick={onBack} style={{...S.btn,background:"none",border:"1px solid #e5e7eb",color:"#6b7280"}}>Cancelar</button>
        <button onClick={async()=>{setSaving(true);await onSave({scores,observations:obs,commission_evaluated:ck});setSaving(false);}}
          style={{...S.btn,background:"#3730a3",color:"#fff"}}>
          {saving?"Salvando...":"Salvar avaliação →"}
        </button>
      </div>
    </div>
  );
}

// ─── STATUS FINAL (somente admin) ─────────────────────────────────────────────
function FinalStatusPanel({candidate,finalStatus,evaluations,me,onSave}){
  const [st,setSt]=useState(finalStatus?.status||"pendente");
  const ck=candidate.commission1;
  const avg=avgScore(evaluations,candidate.id,ck);
  const nEval=evaluations.filter(e=>e.candidate_id===candidate.id&&e.scores).length;
  if(!me.is_admin) return null;
  return(
    <div style={{...S.card,border:"1px solid #e0e7ff",background:"#f5f8ff",marginTop:8}}>
      <div style={{fontSize:12,fontWeight:600,color:"#4338ca",marginBottom:8}}>
        🔒 Status final (Admin) · {nEval} avaliação{nEval!==1?"ões":""} · Média: <strong>{avg??—}</strong>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
        {STATUSES.filter(s=>s.id!=="pendente").map(s=>(
          <button key={s.id} onClick={()=>setSt(s.id)}
            style={{...S.btn,padding:"5px 12px",fontSize:11,
              background:st===s.id?"#3730a3":"#fff",color:st===s.id?"#fff":"#6b7280",
              border:st===s.id?"none":"1px solid #e5e7eb"}}>
            {s.label}
          </button>
        ))}
      </div>
      <button onClick={()=>onSave(st)} style={{...S.btn,background:"#047857",color:"#fff",padding:"6px 16px",fontSize:12}}>
        Confirmar status
      </button>
      {finalStatus?.set_by_name&&<span style={{fontSize:11,color:"#9ca3af",marginLeft:10}}>Definido por {finalStatus.set_by_name}</span>}
    </div>
  );
}

// ─── RANKINGS ─────────────────────────────────────────────────────────────────
function Rankings({candidates,evaluations,finalStatuses,me,onSetFinal,initComm}){
  const [active,setActive]=useState(initComm||"tecnica");
  const ranking=useMemo(()=>candidates
    .filter(c=>c.commission1===active)
    .map(c=>{
      const fs=finalStatuses.find(f=>f.candidate_id===c.id);
      const evs=evaluations.filter(e=>e.candidate_id===c.id&&e.scores);
      const avg=avgScore(evaluations,c.id,active)??0;
      return{...c,fs,evs,avg};
    })
    .filter(c=>c.fs?.status!=="descartado")
    .sort((a,b)=>b.avg-a.avg)
  ,[candidates,evaluations,finalStatuses,active]);
  const vagas=COMMS[active].vagas;
  const comm=COMMS[active];
  return(
    <div style={{padding:24,maxWidth:760}}>
      <h2 style={{fontSize:22,fontWeight:700,color:"#1f2937",marginBottom:12}}>Rankings</h2>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
        {Object.entries(COMMS).map(([k,c])=>{
          const sel=finalStatuses.filter(f=>{const cd=candidates.find(x=>x.id===f.candidate_id);return cd?.commission1===k&&f.status==="selecionado";}).length;
          return(
            <button key={k} onClick={()=>setActive(k)}
              style={{...S.btn,padding:"7px 14px",fontSize:12,background:active===k?c.color:c.light,color:active===k?"#fff":c.text,border:"none"}}>
              {c.name} {sel}/{c.vagas}
            </button>
          );
        })}
      </div>
      {ranking.length===0?(
        <div style={{textAlign:"center",padding:"60px 0",color:"#d1d5db"}}>
          <div style={{fontSize:48,marginBottom:12}}>📊</div>
          <p style={{fontSize:14}}>Nenhum candidato avaliado para esta comissão</p>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {ranking.map((c,i)=>{
            const isSel=i<vagas; const isSup=i>=vagas&&i<vagas+Math.ceil(vagas*0.5);
            return(
              <div key={c.id} style={{background:isSel?"#f0fdf4":isSup?"#fffbeb":"#fff",borderRadius:14,border:`1px solid ${isSel?"#bbf7d0":isSup?"#fde68a":"#f3f4f6"}`,padding:14}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{fontSize:18,fontWeight:900,width:32,textAlign:"center",color:i===0?"#f59e0b":i===1?"#9ca3af":i===2?"#d97706":"#e5e7eb",flexShrink:0}}>{i+1}°</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:14,color:"#1f2937"}}>{c.name}</div>
                    <div style={{fontSize:11,color:"#9ca3af"}}>{c.period||"—"}{c.matricula?` · ${c.matricula}`:""}</div>
                    <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>🎤 {c.evs.length} avaliação{c.evs.length!==1?"ões":""}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:22,fontWeight:900,color:"#4338ca"}}>{c.avg.toFixed(2)}</div>
                    <SBadge status={c.fs?.status||"pendente"}/>
                  </div>
                  {isSel&&<span style={{fontSize:10,background:"#dcfce7",color:"#15803d",padding:"3px 8px",borderRadius:99,fontWeight:700}}>✅ Vaga</span>}
                  {isSup&&<span style={{fontSize:10,background:"#fef3c7",color:"#b45309",padding:"3px 8px",borderRadius:99,fontWeight:700}}>🟡 Suplente</span>}
                </div>
                {/* Breakdown por avaliador */}
                {c.evs.length>0&&(
                  <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #f3f4f6",display:"flex",flexWrap:"wrap",gap:8}}>
                    {c.evs.map(e=>(
                      <span key={e.id} style={{fontSize:11,background:"#f3f4f6",padding:"3px 10px",borderRadius:99,color:"#374151"}}>
                        {e.evaluator_name}: <strong>{wScore(e.scores,active).toFixed(2)}</strong>
                        {e.observations&&<span style={{color:"#9ca3af"}}> · "{e.observations.slice(0,40)}..."</span>}
                      </span>
                    ))}
                  </div>
                )}
                {me.is_admin&&(
                  <FinalStatusPanel candidate={c} finalStatus={c.fs} evaluations={evaluations} me={me}
                    onSave={st=>onSetFinal(c.id,st,c.commission1)}/>
                )}
              </div>
            );
          })}
          <p style={{fontSize:11,color:"#d1d5db",textAlign:"center"}}>{comm.name} · {vagas} vagas · Média simples entre avaliadores</p>
        </div>
      )}
    </div>
  );
}

// ─── AVALIADORES ──────────────────────────────────────────────────────────────
function Users({users,me,onAdd,onDel}){
  const [form,setForm]=useState({name:"",email:"",password:"seju2025",leads_commission:"",is_admin:false});
  const [adding,setAdding]=useState(false); const [saving,setSaving]=useState(false);
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));
  const submit=async()=>{
    if(!form.name||!form.email) return;
    setSaving(true); await onAdd(form); setSaving(false);
    setForm({name:"",email:"",password:"seju2025",leads_commission:"",is_admin:false}); setAdding(false);
  };
  return(
    <div style={{...S.page,maxWidth:600}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div><h2 style={{fontSize:22,fontWeight:700,color:"#1f2937",margin:"0 0 2px"}}>Comissão Geral</h2>
          <p style={{fontSize:13,color:"#9ca3af",margin:0}}>{users.length} avaliadores</p></div>
        {me.is_admin&&<button onClick={()=>setAdding(p=>!p)} style={{...S.btn,background:"#3730a3",color:"#fff"}}>+ Novo membro</button>}
      </div>
      {adding&&me.is_admin&&(
        <div style={{...S.card,marginBottom:16}}>
          <h3 style={{fontSize:14,fontWeight:600,color:"#374151",marginBottom:14}}>Cadastrar avaliador</h3>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {[{k:"name",l:"Nome",ph:"Nome do membro",span:2},{k:"email",l:"Email",ph:"email@seju.com"},{k:"password",l:"Senha inicial",ph:"seju2025"}].map(x=>(
              <div key={x.k} style={x.span?{gridColumn:`span ${x.span}`}:{}}>
                <label style={S.label}>{x.l}</label>
                <input value={form[x.k]||""} onChange={e=>upd(x.k,e.target.value)} placeholder={x.ph} type={x.k==="password"?"password":"text"} style={S.input}/>
              </div>
            ))}
            <div>
              <label style={S.label}>Lidera comissão</label>
              <select value={form.leads_commission||""} onChange={e=>upd("leads_commission",e.target.value)} style={S.input}>
                <option value="">Apenas avaliador</option>
                {Object.entries(COMMS).map(([k,c])=><option key={k} value={k}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,margin:"12px 0"}}>
            <input type="checkbox" id="adm" checked={form.is_admin} onChange={e=>upd("is_admin",e.target.checked)}/>
            <label htmlFor="adm" style={{fontSize:13,color:"#6b7280"}}>Admin (pode gerenciar membros e definir status final)</label>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
            <button onClick={()=>setAdding(false)} style={{...S.btn,background:"none",border:"1px solid #e5e7eb",color:"#6b7280"}}>Cancelar</button>
            <button onClick={submit} disabled={!form.name||!form.email||saving} style={{...S.btn,background:"#3730a3",color:"#fff"}}>{saving?"Salvando...":"Cadastrar"}</button>
          </div>
        </div>
      )}
      {users.map(u=>(
        <div key={u.id} style={{...S.card,display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,borderRadius:10,background:"#eef2ff",color:"#4338ca",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,flexShrink:0}}>
            {u.name.charAt(0).toUpperCase()}
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:14,color:"#1f2937",display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
              {u.name}
              {u.is_admin&&<span style={{fontSize:10,background:"#eef2ff",color:"#4338ca",padding:"2px 7px",borderRadius:99}}>Admin</span>}
              {u.id===me.id&&<span style={{fontSize:10,background:"#f3f4f6",color:"#6b7280",padding:"2px 7px",borderRadius:99}}>Você</span>}
            </div>
            <div style={{fontSize:11,color:"#9ca3af"}}>{u.email}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {u.leads_commission&&<CommBadge ck={u.leads_commission}/>}
            {me.is_admin&&u.id!==me.id&&(
              <button onClick={()=>onDel(u.id)} style={{...S.btn,padding:"4px 10px",background:"none",color:"#fca5a5",border:"none",fontSize:12}}>Remover</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── EXPORTAR ─────────────────────────────────────────────────────────────────
function Export({candidates,evaluations,finalStatuses}){
  const byComm=useMemo(()=>{
    const res={};
    Object.keys(COMMS).forEach(k=>{
      res[k]=candidates.filter(c=>c.commission1===k)
        .map(c=>({...c,avg:avgScore(evaluations,c.id,k),evs:evaluations.filter(e=>e.candidate_id===c.id&&e.scores),fs:finalStatuses.find(f=>f.candidate_id===c.id)}))
        .filter(c=>c.fs?.status!=="descartado")
        .sort((a,b)=>(b.avg??0)-(a.avg??0));
    });
    return res;
  },[candidates,evaluations,finalStatuses]);
  return(
    <div style={S.page}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <h2 style={{fontSize:22,fontWeight:700,color:"#1f2937",margin:0}}>Exportar resultados</h2>
        <button onClick={()=>dlCSV(candidates,evaluations,finalStatuses)} style={{...S.btn,background:"#047857",color:"#fff"}}>📥 Baixar CSV</button>
      </div>
      {Object.entries(byComm).map(([k,list])=>{
        if(!list.length) return null;
        const vagas=COMMS[k].vagas;
        return(
          <div key={k} style={{...S.card,overflow:"hidden",padding:0,marginBottom:16}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #f3f4f6",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <CommBadge ck={k}/><span style={{fontSize:11,color:"#9ca3af"}}>{vagas} vagas · {list.length} candidatos</span>
            </div>
            <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
              <thead><tr style={{background:"#f9fafb"}}>
                {["#","Nome","Matrícula","Período","Nota Média","Avaliadores","Status"].map(h=>(
                  <th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:"#9ca3af",textTransform:"uppercase"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {list.map((c,i)=>(
                  <tr key={c.id} style={{borderTop:"1px solid #f9fafb",background:i<vagas?"#f0fdf4":"#fff"}}>
                    <td style={{padding:"8px 12px",color:"#9ca3af",fontWeight:600}}>{i+1}</td>
                    <td style={{padding:"8px 12px",fontWeight:600,color:"#1f2937"}}>{c.name}</td>
                    <td style={{padding:"8px 12px",color:"#6b7280"}}>{c.matricula||"—"}</td>
                    <td style={{padding:"8px 12px",color:"#6b7280"}}>{c.period||"—"}</td>
                    <td style={{padding:"8px 12px",fontWeight:700,color:"#4338ca"}}>{c.avg?.toFixed(2)??"—"}</td>
                    <td style={{padding:"8px 12px",color:"#6b7280"}}>{c.evs.length}</td>
                    <td style={{padding:"8px 12px"}}><SBadge status={c.fs?.status||"pendente"}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

// ─── LAYOUT ───────────────────────────────────────────────────────────────────
const NAV=[{id:"dashboard",icon:"📊",label:"Dashboard"},{id:"candidates",icon:"👥",label:"Candidatos"},{id:"rankings",icon:"🏆",label:"Rankings"},{id:"users",icon:"👤",label:"Avaliadores"},{id:"export",icon:"📥",label:"Exportar"}];

function Layout({me,page,onNav,onLogout,children}){
  return(
    <div style={{display:"flex",minHeight:"100vh",background:"#f9fafb"}}>
      <aside style={{width:200,flexShrink:0,background:"#0f0d2b",display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh"}}>
        <div style={{padding:"16px 14px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:20}}>⚖️</span>
            <div><div style={{fontSize:13,fontWeight:700,color:"#fff"}}>SEJU Select</div>
              <div style={{fontSize:10,color:"#818cf8"}}>Semana Jurídica</div></div>
          </div>
        </div>
        <nav style={{flex:1,padding:"8px 6px"}}>
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>onNav(n.id)}
              style={{width:"100%",textAlign:"left",padding:"9px 10px",borderRadius:10,fontSize:13,fontWeight:500,border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:8,marginBottom:2,
                background:page===n.id?"#3730a3":"transparent",color:page===n.id?"#fff":"#a5b4fc"}}>
              <span style={{fontSize:15}}>{n.icon}</span><span style={{whiteSpace:"nowrap"}}>{n.label}</span>
            </button>
          ))}
        </nav>
        <div style={{padding:"8px 6px",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
          <div style={{padding:"8px 10px",marginBottom:4}}>
            <div style={{fontSize:12,fontWeight:600,color:"#e0e7ff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{me.name}</div>
            {me.leads_commission&&<div style={{fontSize:10,color:"#818cf8",marginTop:1}}>Líder: {COMMS[me.leads_commission]?.name}</div>}
            {me.is_admin&&<div style={{fontSize:10,color:"#fbbf24",marginTop:1}}>⭐ Admin</div>}
          </div>
          <button onClick={onLogout} style={{width:"100%",textAlign:"left",padding:"8px 10px",borderRadius:10,fontSize:12,border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:6,background:"transparent",color:"#818cf8"}}>
            <span>🚪</span><span>Sair</span>
          </button>
        </div>
      </aside>
      <main style={{flex:1,overflowY:"auto"}}>{children}</main>
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
export default function App(){
  const [me,setMe]=useState(null);
  const [page,setPage]=useState("dashboard");
  const [users,setUsers]=useState([]);
  const [candidates,setCandidates]=useState([]);
  const [evaluations,setEvaluations]=useState([]);
  const [finalStatuses,setFinalStatuses]=useState([]);
  const [evalCandidate,setEvalCandidate]=useState(null);
  const [rankComm,setRankComm]=useState(null);
  const [toast,setToast]=useState("");
  const [loading,setLoading]=useState(false);

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(""),3000);};

  // Carrega todos os dados
  const loadAll=useCallback(async()=>{
    setLoading(true);
    const [u,c,e,f]=await Promise.all([
      supabase.from("users").select("*").order("created_at"),
      supabase.from("candidates").select("*").order("name"),
      supabase.from("evaluations").select("*"),
      supabase.from("final_status").select("*"),
    ]);
    if(u.data) setUsers(u.data);
    if(c.data) setCandidates(c.data);
    if(e.data) setEvaluations(e.data);
    if(f.data) setFinalStatuses(f.data);
    setLoading(false);
  },[]);

  // Realtime: escuta avaliações e final_status em tempo real
  useEffect(()=>{
    if(!me) return;
    loadAll();
    const ch1=supabase.channel("evals").on("postgres_changes",{event:"*",schema:"public",table:"evaluations"},()=>
      supabase.from("evaluations").select("*").then(r=>{if(r.data) setEvaluations(r.data);})).subscribe();
    const ch2=supabase.channel("finals").on("postgres_changes",{event:"*",schema:"public",table:"final_status"},()=>
      supabase.from("final_status").select("*").then(r=>{if(r.data) setFinalStatuses(r.data);})).subscribe();
    const ch3=supabase.channel("cands").on("postgres_changes",{event:"*",schema:"public",table:"candidates"},()=>
      supabase.from("candidates").select("*").order("name").then(r=>{if(r.data) setCandidates(r.data);})).subscribe();
    return()=>{ supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3); };
  },[me]);

  const saveEval=async(data)=>{
    const payload={candidate_id:evalCandidate.id,evaluator_id:me.id,evaluator_name:me.name,...data};
    const {error}=await supabase.from("evaluations").upsert(payload,{onConflict:"candidate_id,evaluator_id"});
    if(!error){ showToast("Avaliação salva!"); setRankComm(evalCandidate.commission1); setEvalCandidate(null); setPage("rankings"); }
    else showToast("Erro ao salvar: "+error.message);
  };

  const setFinalStatus=async(candidateId,status,ck)=>{
    const payload={candidate_id:candidateId,status,commission_evaluated:ck,set_by:me.id,set_by_name:me.name};
    await supabase.from("final_status").upsert(payload,{onConflict:"candidate_id"});
    showToast("Status atualizado!");
  };

  const discard=async(candidateId)=>{
    await supabase.from("final_status").upsert({candidate_id:candidateId,status:"descartado",set_by:me.id,set_by_name:me.name},{onConflict:"candidate_id"});
    showToast("Candidato descartado.");
  };

  const importCSV=async(txt)=>{
    const parsed=parseCSV(txt);
    if(!parsed.length){ showToast("Nenhum candidato encontrado."); return; }
    const {error}=await supabase.from("candidates").insert(parsed);
    if(!error) showToast(`${parsed.length} candidatos importados!`);
    else showToast("Erro: "+error.message);
  };

  const addCandidate=async(data)=>{
    await supabase.from("candidates").insert(data);
    showToast("Candidato cadastrado!");
    setPage("candidates");
  };

  const addUser=async(data)=>{
    const {error}=await supabase.from("users").insert(data);
    if(!error){ showToast("Avaliador cadastrado!"); await loadAll(); }
    else showToast("Erro: "+error.message);
  };

  const delUser=async(id)=>{
    await supabase.from("users").delete().eq("id",id);
    await loadAll();
  };

  if(!me) return <LoginScreen onLogin={u=>{setMe(u);}} />;
  if(loading) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f9fafb",color:"#9ca3af"}}>Carregando dados...</div>;

  const renderPage=()=>{
    if(page==="evaluate"&&evalCandidate) return(
      <EvaluateForm candidate={evalCandidate} myEval={evaluations.find(e=>e.candidate_id===evalCandidate.id&&e.evaluator_id===me.id)}
        me={me} allEvals={evaluations.filter(e=>e.candidate_id===evalCandidate.id)}
        onSave={saveEval} onBack={()=>{ setEvalCandidate(null); setPage("candidates"); }}/>
    );
    if(page==="candidates") return(
      <CandidatesList candidates={candidates} evaluations={evaluations} finalStatuses={finalStatuses} me={me}
        onAdd={()=>setPage("add_candidate")} onEval={c=>{setEvalCandidate(c);setPage("evaluate");}}
        onImport={importCSV} onDiscard={discard}/>
    );
    if(page==="add_candidate") return(
      <div style={{padding:24,maxWidth:600}}>
        <button onClick={()=>setPage("candidates")} style={{background:"none",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:13,marginBottom:16}}>← Voltar</button>
        <h2 style={{fontSize:20,fontWeight:700,color:"#1f2937",margin:"0 0 20px"}}>Novo candidato</h2>
        <div style={S.card}>
          {["name","email","phone","period","matricula","commission1"].map(k=>(
            k==="commission1"?(
              <div key={k} style={{marginBottom:14}}>
                <label style={S.label}>Comissão</label>
                <select id={k} style={S.input} defaultValue="tecnica">
                  {Object.entries(COMMS).map(([ck,c])=><option key={ck} value={ck}>{c.name}</option>)}
                </select>
              </div>
            ):(
              <div key={k} style={{marginBottom:14}}>
                <label style={S.label}>{k==="name"?"Nome completo":k==="email"?"Email":k==="phone"?"Telefone":k==="period"?"Período/Turno":"Matrícula"}</label>
                <input id={k} style={S.input} placeholder=""/>
              </div>
            )
          ))}
          <button onClick={()=>{
            const get=id=>document.getElementById(id)?.value||"";
            addCandidate({name:get("name"),email:get("email"),phone:get("phone"),period:get("period"),matricula:get("matricula"),commission1:get("commission1")});
          }} style={{...S.btn,background:"#3730a3",color:"#fff",width:"100%"}}>Cadastrar</button>
        </div>
      </div>
    );
    if(page==="rankings") return <Rankings candidates={candidates} evaluations={evaluations} finalStatuses={finalStatuses} me={me} onSetFinal={setFinalStatus} initComm={rankComm}/>;
    if(page==="users") return <Users users={users} me={me} onAdd={addUser} onDel={delUser}/>;
    if(page==="export") return <Export candidates={candidates} evaluations={evaluations} finalStatuses={finalStatuses}/>;
    return <Dashboard candidates={candidates} evaluations={evaluations} finalStatuses={finalStatuses}/>;
  };

  return(
    <Layout me={me} page={page} onNav={p=>{setPage(p);if(p!=="rankings")setRankComm(null);}} onLogout={()=>{setMe(null);setPage("dashboard");}}>
      {renderPage()}
      <Toast msg={toast}/>
    </Layout>
  );
}
