import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const T = {
  ink:"#1A1A1A", ink2:"#6B6B6B", ink3:"#A0A0A0",
  surface:"#FFFFFF", surface2:"#F7F7F5", surface3:"#F0F0ED",
  border:"#E8E8E4", border2:"#D0D0CC",
  accent:"#3730A3", accentLight:"#EEF2FF", accentMid:"#6366F1",
  green:"#15803D", greenLight:"#F0FDF4", greenBorder:"#BBF7D0",
  amber:"#B45309", amberLight:"#FFFBEB", amberBorder:"#FDE68A",
  red:"#DC2626", redLight:"#FEF2F2", redBorder:"#FECACA",
  blue:"#1D4ED8", blueLight:"#EFF6FF",
};

const COMMS = {
  tecnica:    { name:"Técnica",             vagas:11, color:"#3730A3", light:"#EEF2FF", text:"#3730A3" },
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
  { id:"entrevistado",    label:"Entrevistado"    },
  { id:"selecionado",     label:"Selecionado"     },
  { id:"suplente",        label:"Suplente"        },
  { id:"remanejar",       label:"Remanejar"       },
  { id:"nao_selecionado", label:"Não selecionado" },
  { id:"descartado",      label:"Descartado"      },
];

// ─── UTILS ───────────────────────────────────────────────────────────────────
const norm = s => (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");

function wScore(sc, ck){
  if(!sc||!ck||!W[ck]) return 0;
  const w=W[ck]; let tot=0, ws=0;
  CRIT.forEach((c,i)=>{ const v=Number(sc[c.id]??0); tot+=v*w[i]; ws+=w[i]; });
  return ws>0 ? parseFloat((tot/ws).toFixed(2)) : 0;
}
function avgScore(evals, candidateId, ck){
  const evs=evals.filter(e=>e.candidate_id===candidateId&&e.scores);
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

// ─── CSV ─────────────────────────────────────────────────────────────────────
function parseCSVRows(txt,sep){
  const rows=[]; let row=[],cur="",inQ=false;
  for(let i=0;i<txt.length;i++){
    const c=txt[i];
    if(c==='"'){ if(inQ&&txt[i+1]==='"'){cur+='"';i++;} else inQ=!inQ; }
    else if(c===sep&&!inQ){ row.push(cur.trim()); cur=""; }
    else if((c==='\n'||c==='\r')&&!inQ){
      if(c==='\r'&&txt[i+1]==='\n') i++;
      row.push(cur.trim()); if(row.some(x=>x)) rows.push(row); row=[]; cur="";
    } else cur+=c;
  }
  row.push(cur.trim()); if(row.some(x=>x)) rows.push(row);
  return rows;
}
function parseCSV(txt){
  txt=txt.replace(/^\uFEFF/,"");
  const sep=txt.split("\n")[0].includes(";")?";":","
  const rows=parseCSVRows(txt,sep); if(rows.length<2) return [];
  const hdrs=rows[0].map(h=>h.replace(/^"|"$/g,"").replace(/:+$/,"").trim());
  const fn=(kws)=>hdrs.findIndex(h=>kws.every(k=>norm(h).includes(k)));
  const iName=fn(["nome","completo"]),iEmail=fn(["e-mail"])!==-1?fn(["e-mail"]):fn(["email"]);
  const iPhone=fn(["telefone"]),iPeriod=fn(["periodo"]),iComm=fn(["comissao","seju"]);
  const iAvail=fn(["disponibilidade"]),iExp=fn(["participou","evento"]);
  const iExtra=fn(["extracurricular"]),iText=fn(["elabore"]);
  const iMatric=fn(["matricula"]),iBirth=fn(["nascimento"]),iCPF=fn(["cpf"]),iRoutine=fn(["rotina"]);
  const seen=new Set();
  return rows.slice(1).map(v=>{
    const get=i=>i>=0?(v[i]||"").replace(/^"|"$/g,"").trim():"";
    const name=get(iName); if(!name) return null;
    const key=norm(name)+get(iEmail); if(seen.has(key)) return null; seen.add(key);
    return { name, email:get(iEmail), phone:get(iPhone), period:get(iPeriod),
      commission1:mapComm(get(iComm)), commission_raw:get(iComm), availability:get(iAvail),
      skills:get(iExtra).slice(0,400), notes:get(iText).slice(0,600), matricula:get(iMatric),
      birthdate:get(iBirth), cpf:get(iCPF), event_exp:get(iExp).slice(0,400), routine:get(iRoutine).slice(0,400) };
  }).filter(Boolean);
}
function dlCSV(candidates,evaluations,finalStatuses){
  const rows=[["Nome","Matrícula","Período","Email","Comissão","Nota Média","Nº Avaliadores","Status","Observações"]];
  candidates.forEach(c=>{
    const ck=c.commission1; const avg=avgScore(evaluations,c.id,ck);
    const fs=finalStatuses.find(f=>f.candidate_id===c.id);
    const obs=evaluations.filter(e=>e.candidate_id===c.id&&e.observations).map(e=>`[${e.evaluator_name}] ${e.observations}`).join(" | ");
    const nEval=evaluations.filter(e=>e.candidate_id===c.id&&e.scores).length;
    rows.push([c.name,c.matricula||"",c.period||"",c.email||"",COMMS[ck]?.name||"",avg??"",nEval,
      STATUSES.find(s=>s.id===(fs?.status||"pendente"))?.label||"",obs.replace(/"/g,"'")
    ].map(x=>`"${x}"`).join(","));
  });
  const blob=new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv;charset=utf-8;"});
  const a=Object.assign(document.createElement("a"),{href:URL.createObjectURL(blob),download:"SEJU_Select.csv"});
  a.click();
}

// ─── STYLE HELPERS ────────────────────────────────────────────────────────────
const css = {
  card: { background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"18px 20px", marginBottom:10 },
  label: { fontSize:11, fontWeight:600, color:T.ink3, textTransform:"uppercase", letterSpacing:.7, display:"block", marginBottom:5 },
  input: { width:"100%", border:`1px solid ${T.border}`, borderRadius:8, padding:"9px 12px", fontSize:13, background:T.surface, color:T.ink, boxSizing:"border-box", outline:"none" },
  btn: { border:"none", borderRadius:8, padding:"8px 16px", fontSize:13, fontWeight:500, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:6 },
  btnPrimary: { background:T.accent, color:"#fff" },
  btnSecondary: { background:T.surface, color:T.ink, border:`1px solid ${T.border2}` },
  btnSm: { padding:"6px 12px", fontSize:12 },
  btnDanger: { background:T.surface, color:T.red, border:`1px solid ${T.redBorder}` },
};

function CommBadge({ck}){
  const c=COMMS[ck]; if(!c) return null;
  return <span style={{background:c.light,color:c.text,padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:600,display:"inline-block"}}>{c.name}</span>;
}
function SBadge({status}){
  const map={
    pendente:[T.surface3,T.ink2], entrevistado:[T.blueLight,T.blue],
    selecionado:[T.greenLight,T.green], suplente:[T.amberLight,T.amber],
    remanejar:[T.accentLight,T.accent], nao_selecionado:[T.redLight,T.red],
    descartado:[T.surface3,T.ink3]
  };
  const [bg,tc]=map[status]||map.pendente;
  return <span style={{background:bg,color:tc,padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:600}}>{STATUSES.find(s=>s.id===status)?.label||"Pendente"}</span>;
}
function Avatar({name,size=34,bg=T.accentLight,color=T.accent}){
  return(
    <div style={{width:size,height:size,borderRadius:size<30?99:10,background:bg,color,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:600,fontSize:size*0.38,flexShrink:0}}>
      {(name||"?").charAt(0).toUpperCase()}
    </div>
  );
}
function ProgressBar({pct,color}){
  return(
    <div style={{flex:1,height:3,background:T.surface3,borderRadius:99,overflow:"hidden"}}>
      <div style={{width:`${Math.min(100,pct)}%`,height:"100%",background:color,borderRadius:99,transition:"width .4s"}}/>
    </div>
  );
}
function Toast({msg}){
  if(!msg) return null;
  return <div style={{position:"fixed",bottom:28,left:"50%",transform:"translateX(-50%)",background:T.ink,color:"#fff",padding:"10px 22px",borderRadius:10,fontSize:13,fontWeight:500,zIndex:9999,letterSpacing:"-.1px"}}>{msg}</div>;
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({onLogin}){
  const [email,setEmail]=useState("");
  const [pwd,setPwd]=useState("");
  const [err,setErr]=useState(""); const [loading,setLoading]=useState(false);
  const go=async()=>{
    setLoading(true); setErr("");
    const {data,error}=await supabase.from("users").select("*").eq("email",email).eq("password",pwd).single();
    setLoading(false);
    if(error||!data) setErr("Email ou senha incorretos.");
    else{ onLogin(data); localStorage.setItem("seju_user",JSON.stringify(data)); }
  };
  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:T.surface2}}>
      <div style={{...css.card,width:"100%",maxWidth:380,padding:"2.5rem",margin:0}}>
        <div style={{textAlign:"center",marginBottom:"2rem"}}>
          <div style={{width:44,height:44,borderRadius:12,background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,margin:"0 auto 14px"}}>⚖️</div>
          <h1 style={{fontSize:20,fontWeight:600,color:T.ink,margin:0,letterSpacing:"-.4px"}}>SEJU Select</h1>
          <p style={{fontSize:13,color:T.ink3,margin:"5px 0 0"}}>V SEJU 2026.1 · Sistema de Seleção</p>
        </div>
        {[{l:"Email",v:email,s:setEmail,t:"email"},{l:"Senha",v:pwd,s:setPwd,t:"password"}].map(x=>(
          <div key={x.l} style={{marginBottom:14}}>
            <label style={css.label}>{x.l}</label>
            <input type={x.t} value={x.v} onChange={e=>x.s(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()}
              style={css.input}/>
          </div>
        ))}
        {err&&<div style={{background:T.redLight,color:T.red,fontSize:13,padding:"8px 12px",borderRadius:8,marginBottom:14}}>{err}</div>}
        <button onClick={go} disabled={loading} style={{...css.btn,...css.btnPrimary,width:"100%",justifyContent:"center",padding:"10px"}}>
          {loading?"Entrando...":"Entrar"}
        </button>
      </div>
    </div>
  );
}

// ─── HOOK DE PADDING RESPONSIVO ───────────────────────────────────────────────
function usePad(){ const m=useIsMobile(); return m?"16px 14px 48px":"28px 32px 48px"; }

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({candidates,evaluations,finalStatuses}){
  const isMobile=useIsMobile(); const pad=usePad();
  const discardedIds=new Set(finalStatuses.filter(f=>f.status==="descartado").map(f=>f.candidate_id));
  const activeC=candidates.filter(c=>!discardedIds.has(c.id));
  const total=candidates.length, discarded=discardedIds.size;
  const evaled=new Set(evaluations.filter(e=>!discardedIds.has(e.candidate_id)).map(e=>e.candidate_id)).size;
  const selected=finalStatuses.filter(f=>f.status==="selecionado").length;
  const byComm=useMemo(()=>Object.entries(COMMS).map(([k,c])=>{
    const inC=candidates.filter(x=>x.commission1===k&&!discardedIds.has(x.id));
    const sel=finalStatuses.filter(f=>{const cd=candidates.find(x=>x.id===f.candidate_id);return cd?.commission1===k&&f.status==="selecionado";}).length;
    const sup=finalStatuses.filter(f=>{const cd=candidates.find(x=>x.id===f.candidate_id);return cd?.commission1===k&&f.status==="suplente";}).length;
    const entrev=new Set(evaluations.filter(e=>inC.some(x=>x.id===e.candidate_id)).map(e=>e.candidate_id)).size;
    return{k,c,total:inC.length,entrev,sel,sup};
  }),[candidates,evaluations,finalStatuses]);
  const stats=[
    {l:"Total inscritos",v:total,vc:T.ink,sub:`${Object.keys(COMMS).length} comissões`},
    {l:"Com avaliação",v:evaled,vc:T.green,sub:`${total>0?Math.round(evaled/total*100):0}% do total`},
    {l:"Pendentes",v:activeC.length-evaled,vc:T.amber,sub:"aguardando"},
    {l:"Selecionados",v:selected,vc:T.green,sub:"de 31 vagas"},
    {l:"Descartados",v:discarded,vc:T.ink3,sub:"sem avaliação"},
  ];
  return(
    <div style={{padding:pad,maxWidth:800}}>
      <div style={{marginBottom:20}}>
        <h2 style={{fontSize:isMobile?18:22,fontWeight:600,color:T.ink,letterSpacing:"-.4px",margin:"0 0 3px"}}>Dashboard</h2>
        <p style={{fontSize:13,color:T.ink3,margin:0}}>Processo seletivo · tempo real</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(5,1fr)",gap:8,marginBottom:20}}>
        {stats.map(s=>(
          <div key={s.l} style={{...css.card,padding:"14px 14px",marginBottom:0}}>
            <div style={{fontSize:10,fontWeight:600,color:T.ink3,textTransform:"uppercase",letterSpacing:.7,marginBottom:8}}>{s.l}</div>
            <div style={{fontSize:22,fontWeight:600,color:s.vc,letterSpacing:"-1px",lineHeight:1}}>{s.v}</div>
            <div style={{fontSize:11,color:T.ink3,marginTop:5}}>{s.sub}</div>
          </div>
        ))}
      </div>
      <h3 style={{fontSize:13,fontWeight:600,color:T.ink,marginBottom:10}}>Por comissão</h3>
      {byComm.map(({k,c,total,entrev,sel,sup})=>(
        <div key={k} style={{...css.card,padding:0,marginBottom:8}}>
          <div style={{padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${T.border}`,flexWrap:"wrap",gap:6}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}><CommBadge ck={k}/><span style={{fontSize:12,color:T.ink3}}>{total} inscritos</span></div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              {!isMobile&&<span style={{fontSize:11,color:T.ink3}}>🎤 {entrev} · 🟡 {sup} · ⏳ {total-entrev}</span>}
              <span style={{fontSize:13,fontWeight:600,color:T.ink}}>{sel}<span style={{fontWeight:400,color:T.ink3}}>/{c.vagas}</span></span>
            </div>
          </div>
          <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
            <ProgressBar pct={c.vagas>0?Math.round((sel/c.vagas)*100):0} color={c.color}/>
            <span style={{fontSize:11,fontWeight:600,color:c.color,minWidth:30,textAlign:"right"}}>{c.vagas>0?Math.round((sel/c.vagas)*100):0}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── CANDIDATOS ───────────────────────────────────────────────────────────────
function CandidatesList({candidates,evaluations,finalStatuses,me,onAdd,onEval,onImport,onDiscard}){
  const isMobile=useIsMobile(); const pad=usePad();
  const [search,setSearch]=useState("");
  const byComm=useMemo(()=>Object.entries(COMMS).map(([k,c])=>{
    const q=norm(search);
    const list=candidates.filter(x=>x.commission1===k&&(norm(x.name).includes(q)||norm(x.period||"").includes(q)||norm(x.matricula||"").includes(q)||q===""));
    return{k,c,list};
  }),[candidates,search]);
  return(
    <div style={{padding:pad,maxWidth:800}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20,gap:10}}>
        <div>
          <h2 style={{fontSize:isMobile?18:22,fontWeight:600,color:T.ink,letterSpacing:"-.4px",margin:"0 0 3px"}}>Candidatos</h2>
          <p style={{fontSize:13,color:T.ink3,margin:0}}>{candidates.length} inscritos</p>
        </div>
        <div style={{display:"flex",gap:6,flexShrink:0}}>
          {me.is_admin&&(
            <label style={{...css.btn,...css.btnSecondary,...css.btnSm,cursor:"pointer",whiteSpace:"nowrap"}}>
              {isMobile?"↓ CSV":"↓ Importar CSV"}
              <input type="file" accept=".csv,.txt" style={{display:"none"}} onChange={e=>{
                const f=e.target.files[0]; if(!f) return;
                const r=new FileReader(); r.onload=ev=>onImport(ev.target.result); r.readAsText(f,"UTF-8"); e.target.value="";
              }}/>
            </label>
          )}
          {me.is_admin&&<button onClick={onAdd} style={{...css.btn,...css.btnPrimary,...css.btnSm,whiteSpace:"nowrap"}}>{isMobile?"+ Novo":"+ Novo candidato"}</button>}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:"0 14px",height:38,marginBottom:20}}>
        <span style={{color:T.ink3,fontSize:14}}>⌕</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome, matrícula ou período..."
          style={{border:"none",outline:"none",fontSize:13,color:T.ink,background:"transparent",flex:1,minWidth:0}}/>
      </div>
      {candidates.length===0&&(
        <div style={{textAlign:"center",padding:"48px 0",color:T.ink3}}>
          <div style={{fontSize:36,marginBottom:10,opacity:.4}}>📭</div>
          <p style={{fontSize:14,margin:0}}>Nenhum candidato cadastrado ainda.</p>
        </div>
      )}
      {byComm.map(({k,c,list})=>{
        if(!list.length) return null;
        return(
          <div key={k} style={{marginBottom:24}}>
            <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:10,borderBottom:`1px solid ${T.border}`,marginBottom:8}}>
              <div style={{width:3,height:14,borderRadius:99,background:c.color}}/>
              <span style={{fontSize:13,fontWeight:600,color:T.ink}}>{c.name}</span>
              <span style={{fontSize:11,color:T.ink3}}>{list.length} candidato{list.length!==1?"s":""}</span>
              <span style={{marginLeft:"auto",fontSize:11,color:T.ink3}}>{c.vagas} vagas</span>
            </div>
            {list.map(cd=>{
              const myEval=evaluations.find(e=>e.candidate_id===cd.id&&e.evaluator_id===me.id);
              const allEvals=evaluations.filter(e=>e.candidate_id===cd.id&&e.scores);
              const fs=finalStatuses.find(f=>f.candidate_id===cd.id);
              const avg=avgScore(evaluations,cd.id,cd.commission1);
              const st=fs?.status||"pendente";
              return(
                <div key={cd.id} style={{...css.card,display:"flex",alignItems:"center",gap:12,opacity:st==="descartado"?0.45:1,padding:"12px 14px"}}>
                  {!isMobile&&<Avatar name={cd.name} bg={c.light} color={c.text}/>}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,color:T.ink}}>{cd.name}</div>
                    <div style={{fontSize:11,color:T.ink3,marginTop:2}}>{cd.period||"—"}{cd.matricula?` · ${cd.matricula}`:""}</div>
                    {allEvals.length>0&&<div style={{fontSize:11,color:T.ink3,marginTop:2}}>{allEvals.length} aval. · média <strong style={{color:T.accent}}>{avg}</strong></div>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0,flexWrap:isMobile?"wrap":"nowrap",justifyContent:"flex-end"}}>
                    <SBadge status={st}/>
                    {st!=="descartado"&&(
                      <>
                        {me.is_admin&&st==="pendente"&&!isMobile&&(
                          <button onClick={()=>onDiscard(cd.id)} style={{...css.btn,...css.btnSm,...css.btnDanger}}>Descartar</button>
                        )}
                        <button onClick={()=>onEval(cd)} style={{...css.btn,...css.btnSm,
                          ...(myEval?.scores?{background:T.greenLight,color:T.green,border:`1px solid ${T.greenBorder}`}:css.btnPrimary),whiteSpace:"nowrap"}}>
                          {myEval?.scores?(isMobile?"Ver":"Ver avaliação"):(isMobile?"Avaliar":"Iniciar entrevista")}
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

// ─── FORM CANDIDATO ───────────────────────────────────────────────────────────
function CandidateForm({onSave,onBack}){
  const [f,setF]=useState({name:"",email:"",phone:"",period:"",matricula:"",commission1:"tecnica"});
  const upd=(k,v)=>setF(p=>({...p,[k]:v}));
  const fields=[{k:"name",l:"Nome completo",span:2},{k:"email",l:"Email"},{k:"phone",l:"Telefone"},{k:"period",l:"Período / Turno"},{k:"matricula",l:"Matrícula"}];
  return(
    <div style={{padding:"28px 32px",maxWidth:600}}>
      <button onClick={onBack} style={{...css.btn,background:"none",border:"none",color:T.ink3,padding:"0 0 16px",fontSize:13}}>← Voltar</button>
      <h2 style={{fontSize:20,fontWeight:600,color:T.ink,margin:"0 0 24px",letterSpacing:"-.4px"}}>Novo candidato</h2>
      <div style={{...css.card,padding:24}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {fields.map(x=>(
            <div key={x.k} style={x.span?{gridColumn:`span ${x.span}`}:{}}>
              <label style={css.label}>{x.l}</label>
              <input value={f[x.k]||""} onChange={e=>upd(x.k,e.target.value)} style={css.input}/>
            </div>
          ))}
          <div style={{gridColumn:"span 2"}}>
            <label style={css.label}>Comissão</label>
            <select value={f.commission1} onChange={e=>upd("commission1",e.target.value)} style={{...css.input}}>
              {Object.entries(COMMS).map(([k,c])=><option key={k} value={k}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
          <button onClick={onBack} style={{...css.btn,...css.btnSecondary}}>Cancelar</button>
          <button onClick={()=>onSave(f)} disabled={!f.name} style={{...css.btn,...css.btnPrimary,opacity:f.name?1:.5}}>Cadastrar</button>
        </div>
      </div>
    </div>
  );
}

// ─── AVALIAÇÃO ────────────────────────────────────────────────────────────────
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
  const lbl=myScore>=8?"Excelente":myScore>=6.5?"Bom":myScore>=5?"Regular":myScore>0?"Baixo":"—";
  const lblColor=myScore>=8?T.green:myScore>=6.5?T.accent:myScore>=5?T.amber:T.red;
  const peers=allEvals.filter(e=>e.evaluator_id!==me.id&&e.scores);

  return(
    <div style={{padding:"28px 32px 48px",maxWidth:680}}>
      <button onClick={onBack} style={{...css.btn,background:"none",border:"none",color:T.ink3,padding:"0 0 16px",fontSize:13}}>← Candidatos</button>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <Avatar name={candidate.name} size={40} bg={comm.light} color={comm.text}/>
          <div>
            <h2 style={{fontSize:18,fontWeight:600,color:T.ink,margin:"0 0 2px",letterSpacing:"-.3px"}}>{candidate.name}</h2>
            <p style={{fontSize:12,color:T.ink3,margin:0}}>Avaliação de <strong style={{color:T.ink}}>{me.name}</strong> · {comm.name}</p>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:32,fontWeight:600,color:T.accent,letterSpacing:"-1.5px"}}>{myScore.toFixed(2)}</div>
          <div style={{fontSize:11,fontWeight:600,color:lblColor}}>{lbl}</div>
        </div>
      </div>

      {/* Info do candidato */}
      <div style={{...css.card,background:comm.light,border:`1px solid ${comm.color}22`,marginBottom:12,padding:"14px 16px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:candidate.event_exp||candidate.skills||candidate.routine||candidate.notes?12:0}}>
          {[{l:"Período",v:candidate.period},{l:"Matrícula",v:candidate.matricula},{l:"Disponibilidade",v:candidate.availability},{l:"Nascimento",v:candidate.birthdate},{l:"CPF",v:candidate.cpf},{l:"Telefone",v:candidate.phone}].filter(x=>x.v).map(x=>(
            <div key={x.l}>
              <div style={{fontSize:10,color:T.ink3,textTransform:"uppercase",letterSpacing:.7,marginBottom:2}}>{x.l}</div>
              <div style={{fontSize:12,fontWeight:500,color:T.ink}}>{x.v}</div>
            </div>
          ))}
        </div>
        {[{l:"Experiência em eventos",v:candidate.event_exp},{l:"Extracurriculares",v:candidate.skills},{l:"Rotina",v:candidate.routine},{l:"Texto motivacional",v:candidate.notes}].filter(x=>x.v).map(x=>(
          <div key={x.l} style={{paddingTop:10,borderTop:`1px solid ${comm.color}22`,marginTop:8}}>
            <div style={{fontSize:10,color:T.ink3,textTransform:"uppercase",letterSpacing:.7,marginBottom:4}}>{x.l}</div>
            <div style={{fontSize:12,color:T.ink,lineHeight:1.7,maxHeight:72,overflowY:"auto"}}>{x.v}</div>
          </div>
        ))}
      </div>

      {/* Avaliações de pares */}
      {peers.length>0&&(
        <div style={{...css.card,marginBottom:12,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <span style={{fontSize:12,fontWeight:600,color:T.ink}}>Avaliações dos colegas</span>
            {avgAll!==null&&<span style={{fontSize:12,color:T.ink3}}>Média geral: <strong style={{color:T.accent}}>{avgAll}</strong></span>}
          </div>
          {peers.map(e=>(
            <div key={e.id} style={{display:"flex",alignItems:"flex-start",gap:10,paddingTop:10,borderTop:`1px solid ${T.border}`}}>
              <Avatar name={e.evaluator_name} size={26} bg={T.surface3} color={T.ink2}/>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{fontSize:12,fontWeight:500,color:T.ink}}>{e.evaluator_name}</span>
                  <span style={{fontSize:14,fontWeight:600,color:T.accent}}>{wScore(e.scores,e.commission_evaluated||ck).toFixed(2)}</span>
                </div>
                {e.observations&&<p style={{fontSize:11,color:T.ink3,fontStyle:"italic",margin:"3px 0 0"}}>"{e.observations}"</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comissão selecionada */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <span style={{fontSize:12,fontWeight:500,color:T.ink2}}>Avaliando para:</span>
        <select value={ck} onChange={e=>setCk(e.target.value)} style={{...css.input,width:"auto",padding:"5px 10px",fontSize:12}}>
          {Object.entries(COMMS).map(([k,c])=><option key={k} value={k}>{c.name}</option>)}
        </select>
        <span style={{fontSize:11,color:T.ink3}}>pesos se ajustam</span>
      </div>

      {/* Critérios */}
      <div style={{...css.card,marginBottom:12,padding:"16px 18px"}}>
        <div style={{fontSize:12,fontWeight:600,color:T.ink,marginBottom:12}}>Critérios de avaliação <span style={{fontWeight:400,color:T.ink3}}>(0–10)</span></div>
        {CRIT.map((c,i)=>{
          const wt=w[i]; const hi=wt>=2; const val=scores[c.id]??0;
          return(
            <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:`1px solid ${T.border}`}}>
              <div style={{flex:1,display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:12,color:T.ink2}}>{c.label}</span>
                {hi&&<span style={{fontSize:10,background:T.accentLight,color:T.accent,padding:"2px 6px",borderRadius:99,fontWeight:600}}>Peso {wt}×</span>}
              </div>
              <div style={{flex:1,height:3,background:T.surface3,borderRadius:99,overflow:"hidden"}}>
                <div style={{width:`${val*10}%`,height:"100%",background:val>=7?T.green:val>=5?T.amber:T.red,borderRadius:99,transition:"width .2s"}}/>
              </div>
              <input type="range" min="0" max="10" step="1" value={val} onChange={e=>setS(c.id,e.target.value)}
                style={{width:80,accentColor:T.accent}}/>
              <input type="number" min="0" max="10" value={val} onChange={e=>setS(c.id,e.target.value)}
                style={{...css.input,width:40,textAlign:"center",padding:"3px 0",fontSize:13,fontWeight:600}}/>
            </div>
          );
        })}
      </div>

      {/* Observações */}
      <div style={{...css.card,marginBottom:16,padding:"14px 16px"}}>
        <label style={css.label}>Minhas observações</label>
        <textarea rows={3} value={obs} onChange={e=>setObs(e.target.value)}
          placeholder="Pontos fortes, fracos, comportamento, adequação ao perfil..."
          style={{...css.input,resize:"none"}}/>
      </div>

      <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
        <button onClick={onBack} style={{...css.btn,...css.btnSecondary}}>Cancelar</button>
        <button onClick={async()=>{setSaving(true);await onSave({scores,observations:obs,commission_evaluated:ck});setSaving(false);}}
          style={{...css.btn,...css.btnPrimary}}>
          {saving?"Salvando...":"Salvar avaliação →"}
        </button>
      </div>
    </div>
  );
}

// ─── STATUS FINAL ─────────────────────────────────────────────────────────────
function FinalStatusPanel({candidate,finalStatus,evaluations,me,onSave}){
  const [st,setSt]=useState(finalStatus?.status||"pendente");
  if(!me.is_admin) return null;
  const ck=candidate.commission1;
  const avg=avgScore(evaluations,candidate.id,ck);
  const nEval=evaluations.filter(e=>e.candidate_id===candidate.id&&e.scores).length;
  return(
    <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${T.border}`}}>
      <div style={{fontSize:11,fontWeight:600,color:T.accent,marginBottom:8}}>
        Status final (Admin) · {nEval} avaliação{nEval!==1?"ões":""} · Média: <strong>{avg??"—"}</strong>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
        {STATUSES.filter(s=>s.id!=="pendente").map(s=>(
          <button key={s.id} onClick={()=>setSt(s.id)} style={{...css.btn,...css.btnSm,
            background:st===s.id?T.accent:T.surface,color:st===s.id?"#fff":T.ink2,
            border:`1px solid ${st===s.id?T.accent:T.border}`}}>
            {s.label}
          </button>
        ))}
      </div>
      <button onClick={()=>onSave(st)} style={{...css.btn,...css.btnSm,background:T.green,color:"#fff"}}>
        Confirmar status
      </button>
      {finalStatus?.set_by_name&&<span style={{fontSize:11,color:T.ink3,marginLeft:10}}>por {finalStatus.set_by_name}</span>}
    </div>
  );
}

// ─── RANKINGS ─────────────────────────────────────────────────────────────────
function Rankings({candidates,evaluations,finalStatuses,me,onSetFinal,initComm}){
  const isMobile=useIsMobile(); const pad=usePad();
  const [active,setActive]=useState(initComm||"tecnica");
  const discardedIds=new Set(finalStatuses.filter(f=>f.status==="descartado").map(f=>f.candidate_id));
  const ranking=useMemo(()=>candidates
    .filter(c=>c.commission1===active&&!discardedIds.has(c.id))
    .map(c=>({...c,fs:finalStatuses.find(f=>f.candidate_id===c.id),evs:evaluations.filter(e=>e.candidate_id===c.id&&e.scores),avg:avgScore(evaluations,c.id,active)??0}))
    .sort((a,b)=>b.avg-a.avg)
  ,[candidates,evaluations,finalStatuses,active]);
  const vagas=COMMS[active].vagas;

  return(
    <div style={{padding:pad,maxWidth:800}}>
      <div style={{marginBottom:20}}>
        <h2 style={{fontSize:isMobile?18:22,fontWeight:600,color:T.ink,letterSpacing:"-.4px",margin:"0 0 3px"}}>Rankings</h2>
        <p style={{fontSize:13,color:T.ink3,margin:0}}>Média simples entre todos os avaliadores</p>
      </div>
      {/* tabs — scroll horizontal no mobile */}
      <div style={{display:"flex",gap:3,marginBottom:16,background:T.surface3,padding:3,borderRadius:10,border:`1px solid ${T.border}`,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        {Object.entries(COMMS).map(([k,c])=>{
          const sel=finalStatuses.filter(f=>{const cd=candidates.find(x=>x.id===f.candidate_id);return cd?.commission1===k&&f.status==="selecionado";}).length;
          return(
            <button key={k} onClick={()=>setActive(k)}
              style={{...css.btn,...css.btnSm,border:"none",flexShrink:0,
                background:active===k?T.surface:"transparent",color:active===k?T.ink:T.ink3,
                boxShadow:active===k?"0 1px 3px rgba(0,0,0,.06)":"none",whiteSpace:"nowrap"}}>
              {isMobile?c.name.split(" ")[0]:c.name} <span style={{color:T.ink3,fontSize:11}}>{sel}/{c.vagas}</span>
            </button>
          );
        })}
      </div>
      {ranking.length===0?(
        <div style={{textAlign:"center",padding:"48px 0",color:T.ink3}}>
          <div style={{fontSize:36,opacity:.4,marginBottom:10}}>📊</div>
          <p style={{fontSize:14,margin:0}}>Nenhum candidato avaliado</p>
        </div>
      ):(
        <div>
          {ranking.map((c,i)=>{
            const isSel=i<vagas; const isSup=i>=vagas&&i<vagas+Math.ceil(vagas*0.5);
            const posColor=i===0?"#B45309":i===1?T.ink3:i===2?"#92400E":T.border2;
            return(
              <div key={c.id} style={{...css.card,padding:"13px 14px",
                background:isSel?T.greenLight:"#fff",
                borderColor:isSel?T.greenBorder:isSup?T.amberBorder:T.border}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{fontSize:13,fontWeight:600,color:posColor,width:24,textAlign:"center",flexShrink:0}}>{i+1}°</div>
                  {!isMobile&&<Avatar name={c.name} size={30} bg={COMMS[active].light} color={COMMS[active].text}/>}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,color:T.ink}}>{c.name}</div>
                    <div style={{fontSize:11,color:T.ink3}}>{c.period||"—"}{!isMobile&&c.matricula?` · ${c.matricula}`:""}</div>
                    {!isMobile&&c.evs.length>0&&(
                      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:4}}>
                        {c.evs.map(e=>(
                          <span key={e.id} style={{fontSize:10,background:T.surface3,border:`1px solid ${T.border}`,color:T.ink2,padding:"2px 7px",borderRadius:99}}>
                            {e.evaluator_name}: <strong>{wScore(e.scores,active).toFixed(2)}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                    {isSel&&<span style={{fontSize:10,background:T.greenLight,color:T.green,padding:"2px 7px",borderRadius:99,fontWeight:600,border:`1px solid ${T.greenBorder}`}}>✓</span>}
                    {isSup&&<span style={{fontSize:10,background:T.amberLight,color:T.amber,padding:"2px 7px",borderRadius:99,fontWeight:600,border:`1px solid ${T.amberBorder}`}}>Sup.</span>}
                    {!isMobile&&<SBadge status={c.fs?.status||"pendente"}/>}
                    <span style={{fontSize:18,fontWeight:600,color:T.accent,letterSpacing:"-1px",minWidth:40,textAlign:"right"}}>{c.avg.toFixed(2)}</span>
                  </div>
                </div>
                {me.is_admin&&(
                  <FinalStatusPanel candidate={c} finalStatus={c.fs} evaluations={evaluations} me={me} onSave={st=>onSetFinal(c.id,st,c.commission1)}/>
                )}
              </div>
            );
          })}
          <p style={{fontSize:11,color:T.ink3,textAlign:"center",marginTop:10}}>{COMMS[active].name} · {vagas} vagas</p>
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
    <div style={{padding:"28px 32px 48px",maxWidth:640}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:24}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:600,color:T.ink,letterSpacing:"-.4px",margin:"0 0 3px"}}>Avaliadores</h2>
          <p style={{fontSize:13,color:T.ink3,margin:0}}>{users.length} membros da Comissão Geral</p>
        </div>
        {me.is_admin&&<button onClick={()=>setAdding(p=>!p)} style={{...css.btn,...css.btnPrimary,...css.btnSm}}>+ Novo membro</button>}
      </div>
      {adding&&(
        <div style={{...css.card,padding:20,marginBottom:16}}>
          <h3 style={{fontSize:13,fontWeight:600,color:T.ink,marginBottom:16}}>Cadastrar avaliador</h3>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {[{k:"name",l:"Nome",ph:"Nome completo",span:2},{k:"email",l:"Email",ph:"email@seju.com"},{k:"password",l:"Senha inicial",ph:"seju2025"}].map(x=>(
              <div key={x.k} style={x.span?{gridColumn:`span ${x.span}`}:{}}>
                <label style={css.label}>{x.l}</label>
                <input value={form[x.k]||""} onChange={e=>upd(x.k,e.target.value)} placeholder={x.ph} type={x.k==="password"?"password":"text"} style={css.input}/>
              </div>
            ))}
            <div>
              <label style={css.label}>Lidera comissão</label>
              <select value={form.leads_commission||""} onChange={e=>upd("leads_commission",e.target.value)} style={css.input}>
                <option value="">Apenas avaliador</option>
                {Object.entries(COMMS).map(([k,c])=><option key={k} value={k}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,margin:"14px 0"}}>
            <input type="checkbox" id="adm" checked={form.is_admin} onChange={e=>upd("is_admin",e.target.checked)}/>
            <label htmlFor="adm" style={{fontSize:13,color:T.ink2}}>Admin — pode gerenciar membros e definir status final</label>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <button onClick={()=>setAdding(false)} style={{...css.btn,...css.btnSecondary}}>Cancelar</button>
            <button onClick={submit} disabled={!form.name||!form.email||saving} style={{...css.btn,...css.btnPrimary,opacity:form.name&&form.email?1:.5}}>
              {saving?"Cadastrando...":"Cadastrar"}
            </button>
          </div>
        </div>
      )}
      <div>
        {users.map(u=>(
          <div key={u.id} style={{...css.card,display:"flex",alignItems:"center",gap:12,padding:"13px 16px"}}>
            <Avatar name={u.name} size={36} bg={T.accentLight} color={T.accent}/>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:500,color:T.ink,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                {u.name}
                {u.is_admin&&<span style={{fontSize:10,background:T.accentLight,color:T.accent,padding:"2px 7px",borderRadius:99,fontWeight:600}}>Admin</span>}
                {u.id===me.id&&<span style={{fontSize:10,background:T.surface3,color:T.ink3,padding:"2px 7px",borderRadius:99}}>Você</span>}
              </div>
              <div style={{fontSize:11,color:T.ink3,marginTop:2}}>{u.email}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              {u.leads_commission&&<CommBadge ck={u.leads_commission}/>}
              {me.is_admin&&u.id!==me.id&&(
                <button onClick={()=>onDel(u.id)} style={{...css.btn,...css.btnSm,background:"none",border:"none",color:T.redBorder,fontSize:12}}>Remover</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── EXPORTAR ─────────────────────────────────────────────────────────────────
function Export({candidates,evaluations,finalStatuses}){
  const discardedIds=new Set(finalStatuses.filter(f=>f.status==="descartado").map(f=>f.candidate_id));
  const byComm=useMemo(()=>{
    const res={};
    Object.keys(COMMS).forEach(k=>{
      res[k]=candidates.filter(c=>c.commission1===k&&!discardedIds.has(c.id))
        .map(c=>({...c,avg:avgScore(evaluations,c.id,k),evs:evaluations.filter(e=>e.candidate_id===c.id&&e.scores),fs:finalStatuses.find(f=>f.candidate_id===c.id)}))
        .sort((a,b)=>(b.avg??0)-(a.avg??0));
    });
    return res;
  },[candidates,evaluations,finalStatuses]);
  const totSel=finalStatuses.filter(f=>f.status==="selecionado").length;
  const totSup=finalStatuses.filter(f=>f.status==="suplente").length;
  return(
    <div style={{padding:"28px 32px 48px",maxWidth:800}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:24}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:600,color:T.ink,letterSpacing:"-.4px",margin:"0 0 3px"}}>Exportar resultados</h2>
          <p style={{fontSize:13,color:T.ink3,margin:0}}>{totSel} selecionados · {totSup} suplentes</p>
        </div>
        <button onClick={()=>dlCSV(candidates,evaluations,finalStatuses)} style={{...css.btn,background:T.green,color:"#fff",...css.btnSm}}>
          ↓ Baixar CSV completo
        </button>
      </div>
      {Object.entries(byComm).map(([k,list])=>{
        if(!list.length) return null;
        const vagas=COMMS[k].vagas;
        return(
          <div key={k} style={{...css.card,overflow:"hidden",padding:0,marginBottom:12}}>
            <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <CommBadge ck={k}/>
              <span style={{fontSize:11,color:T.ink3}}>{vagas} vagas · {list.length} candidatos</span>
            </div>
            <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
              <thead><tr style={{background:T.surface2}}>
                {["#","Nome","Matrícula","Período","Nota","Aval.","Status"].map(h=>(
                  <th key={h} style={{padding:"8px 14px",textAlign:"left",fontSize:10,fontWeight:600,color:T.ink3,textTransform:"uppercase",letterSpacing:.6}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {list.map((c,i)=>(
                  <tr key={c.id} style={{borderTop:`1px solid ${T.border}`,background:i<vagas?T.greenLight:"#fff"}}>
                    <td style={{padding:"9px 14px",color:T.ink3,fontWeight:600}}>{i+1}</td>
                    <td style={{padding:"9px 14px",fontWeight:500,color:T.ink}}>{c.name}</td>
                    <td style={{padding:"9px 14px",color:T.ink2}}>{c.matricula||"—"}</td>
                    <td style={{padding:"9px 14px",color:T.ink2}}>{c.period||"—"}</td>
                    <td style={{padding:"9px 14px",fontWeight:600,color:T.accent}}>{c.avg?.toFixed(2)??"—"}</td>
                    <td style={{padding:"9px 14px",color:T.ink2}}>{c.evs.length}</td>
                    <td style={{padding:"9px 14px"}}><SBadge status={c.fs?.status||"pendente"}/></td>
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

// ─── HOOK RESPONSIVO ──────────────────────────────────────────────────────────
function useIsMobile(){ const [m,setM]=useState(window.innerWidth<768); useEffect(()=>{ const h=()=>setM(window.innerWidth<768); window.addEventListener("resize",h); return()=>window.removeEventListener("resize",h); },[]); return m; }

// ─── LAYOUT ───────────────────────────────────────────────────────────────────
const NAV=[
  {id:"dashboard",icon:"▣",label:"Dashboard",section:"Visão geral"},
  {id:"candidates",icon:"◎",label:"Candidatos",section:null},
  {id:"rankings",icon:"↑",label:"Rankings",section:"Seleção"},
  {id:"users",icon:"◇",label:"Avaliadores",section:null},
  {id:"export",icon:"↓",label:"Exportar",section:"Dados"},
];

function Layout({me,page,onNav,onLogout,children}){
  const isMobile=useIsMobile();
  const [menuOpen,setMenuOpen]=useState(false);
  const navTo=id=>{ onNav(id); setMenuOpen(false); };

  // ── BOTTOM BAR (mobile) ───────────────────────────────────────────────────
  if(isMobile) return(
    <div style={{display:"flex",flexDirection:"column",minHeight:"100vh",background:T.surface2}}>
      {/* top bar */}
      <header style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:28,height:28,borderRadius:8,background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>⚖️</div>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:T.ink,letterSpacing:"-.3px"}}>SEJU Select</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <Avatar name={me.name} size={28} bg={T.accentLight} color={T.accent}/>
          <button onClick={onLogout} style={{...css.btn,background:"none",border:"none",fontSize:12,color:T.ink3,padding:"4px 8px"}}>↩</button>
        </div>
      </header>

      {/* conteúdo */}
      <main style={{flex:1,overflowY:"auto",paddingBottom:72}}>{children}</main>

      {/* bottom nav */}
      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:T.surface,borderTop:`1px solid ${T.border}`,display:"flex",zIndex:100,paddingBottom:"env(safe-area-inset-bottom)"}}>
        {NAV.map(n=>(
          <div key={n.id} onClick={()=>navTo(n.id)}
            style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"10px 4px 8px",cursor:"pointer",
              color:page===n.id?T.accent:T.ink3}}>
            <span style={{fontSize:18,lineHeight:1}}>{n.icon}</span>
            <span style={{fontSize:9,fontWeight:600,marginTop:3,letterSpacing:.3}}>{n.label}</span>
          </div>
        ))}
      </nav>
    </div>
  );

  // ── SIDEBAR (desktop) ─────────────────────────────────────────────────────
  return(
    <div style={{display:"flex",minHeight:"100vh",background:T.surface2}}>
      <aside style={{width:224,flexShrink:0,background:T.surface,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh"}}>
        <div style={{padding:"22px 20px 18px",borderBottom:`1px solid ${T.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,borderRadius:9,background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>⚖️</div>
            <div>
              <div style={{fontSize:14,fontWeight:600,color:T.ink,letterSpacing:"-.3px"}}>SEJU Select</div>
              <div style={{fontSize:11,color:T.ink3,marginTop:1}}>V SEJU 2026.1</div>
            </div>
          </div>
        </div>
        <nav style={{flex:1,padding:"10px 10px",overflowY:"auto"}}>
          {NAV.map(n=>(
            <div key={n.id}>
              {n.section&&<div style={{fontSize:10,fontWeight:600,color:T.ink3,letterSpacing:.8,textTransform:"uppercase",padding:"14px 8px 5px"}}>{n.section}</div>}
              <div onClick={()=>onNav(n.id)}
                style={{display:"flex",alignItems:"center",gap:9,padding:"8px 10px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:500,marginBottom:1,
                  background:page===n.id?T.accentLight:"transparent",color:page===n.id?T.accent:T.ink2}}>
                <span style={{fontSize:13,opacity:page===n.id?1:.6}}>{n.icon}</span>
                {n.label}
              </div>
            </div>
          ))}
        </nav>
        <div style={{padding:"12px 10px",borderTop:`1px solid ${T.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:8,marginBottom:2}}>
            <Avatar name={me.name} size={28} bg={T.accentLight} color={T.accent}/>
            <div style={{minWidth:0}}>
              <div style={{fontSize:12,fontWeight:500,color:T.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{me.name}</div>
              <div style={{fontSize:10,color:T.ink3}}>{me.is_admin?"Admin":"Avaliador"}{me.leads_commission?` · ${COMMS[me.leads_commission]?.name}`:""}</div>
            </div>
          </div>
          <div onClick={onLogout} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:8,cursor:"pointer",fontSize:12,color:T.ink3}}>
            <span>↩</span> Sair
          </div>
        </div>
      </aside>
      <main style={{flex:1,overflowY:"auto"}}>{children}</main>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App(){
  const [me,setMe]=useState(()=>{ try{ const s=localStorage.getItem("seju_user"); return s?JSON.parse(s):null; }catch{ return null; } });
  const [page,setPage]=useState("dashboard");
  const [users,setUsers]=useState([]);
  const [candidates,setCandidates]=useState([]);
  const [evaluations,setEvaluations]=useState([]);
  const [finalStatuses,setFinalStatuses]=useState([]);
  const [evalCandidate,setEvalCandidate]=useState(null);
  const [rankComm,setRankComm]=useState(null);
  const [addingCandidate,setAddingCandidate]=useState(false);
  const [toast,setToast]=useState("");
  const [loading,setLoading]=useState(false);

  const showToast=msg=>{ setToast(msg); setTimeout(()=>setToast(""),3000); };

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

  useEffect(()=>{
    if(!me) return;
    loadAll();
    const ch1=supabase.channel("rt-evals").on("postgres_changes",{event:"*",schema:"public",table:"evaluations"},()=>
      supabase.from("evaluations").select("*").then(r=>{ if(r.data) setEvaluations(r.data); })).subscribe();
    const ch2=supabase.channel("rt-finals").on("postgres_changes",{event:"*",schema:"public",table:"final_status"},()=>
      supabase.from("final_status").select("*").then(r=>{ if(r.data) setFinalStatuses(r.data); })).subscribe();
    const ch3=supabase.channel("rt-cands").on("postgres_changes",{event:"*",schema:"public",table:"candidates"},()=>
      supabase.from("candidates").select("*").order("name").then(r=>{ if(r.data) setCandidates(r.data); })).subscribe();
    return()=>{ supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3); };
  },[me]);

  const saveEval=async(data)=>{
    const payload={candidate_id:evalCandidate.id,evaluator_id:me.id,evaluator_name:me.name,...data};
    const {error}=await supabase.from("evaluations").upsert(payload,{onConflict:"candidate_id,evaluator_id"});
    if(!error){ showToast("Avaliação salva!"); setRankComm(evalCandidate.commission1); setEvalCandidate(null); setPage("rankings"); }
    else showToast("Erro: "+error.message);
  };
  const setFinalStatus=async(candidateId,status,ck)=>{
    await supabase.from("final_status").upsert({candidate_id:candidateId,status,commission_evaluated:ck,set_by:me.id,set_by_name:me.name},{onConflict:"candidate_id"});
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
    showToast("Candidato cadastrado!"); setAddingCandidate(false); setPage("candidates");
  };
  const addUser=async(data)=>{ await supabase.from("users").insert(data); showToast("Avaliador cadastrado!"); await loadAll(); };
  const delUser=async(id)=>{ await supabase.from("users").delete().eq("id",id); await loadAll(); };

  if(!me) return <LoginScreen onLogin={u=>setMe(u)}/>;
  if(loading) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:T.surface2,fontSize:14,color:T.ink3}}>Carregando...</div>;

  const renderPage=()=>{
    if(page==="evaluate"&&evalCandidate) return(
      <EvaluateForm candidate={evalCandidate} myEval={evaluations.find(e=>e.candidate_id===evalCandidate.id&&e.evaluator_id===me.id)}
        me={me} allEvals={evaluations.filter(e=>e.candidate_id===evalCandidate.id)}
        onSave={saveEval} onBack={()=>{ setEvalCandidate(null); setPage("candidates"); }}/>
    );
    if(addingCandidate) return <CandidateForm onSave={addCandidate} onBack={()=>setAddingCandidate(false)}/>;
    if(page==="candidates") return(
      <CandidatesList candidates={candidates} evaluations={evaluations} finalStatuses={finalStatuses} me={me}
        onAdd={()=>setAddingCandidate(true)} onEval={c=>{ setEvalCandidate(c); setPage("evaluate"); }}
        onImport={importCSV} onDiscard={discard}/>
    );
    if(page==="rankings") return <Rankings candidates={candidates} evaluations={evaluations} finalStatuses={finalStatuses} me={me} onSetFinal={setFinalStatus} initComm={rankComm}/>;
    if(page==="users") return <Users users={users} me={me} onAdd={addUser} onDel={delUser}/>;
    if(page==="export") return <Export candidates={candidates} evaluations={evaluations} finalStatuses={finalStatuses}/>;
    return <Dashboard candidates={candidates} evaluations={evaluations} finalStatuses={finalStatuses}/>;
  };

  return(
    <Layout me={me} page={page} onNav={p=>{ setPage(p); if(p!=="rankings") setRankComm(null); setAddingCandidate(false); setEvalCandidate(null); }} onLogout={()=>{ setMe(null); localStorage.removeItem("seju_user"); setPage("dashboard"); }}>
      {renderPage()}
      <Toast msg={toast}/>
    </Layout>
  );
}
