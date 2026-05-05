import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
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

// ─── TOKENS ───────────────────────────────────────────────────────────────────
const T = {
  ink:"#1A1A1A", ink2:"#6B6B6B", ink3:"#A0A0A0",
  surface:"#FFFFFF", surface2:"#F7F7F5", surface3:"#F0F0ED",
  border:"#E8E8E4", border2:"#D0D0CC",
  accent:"#3730A3", accentLight:"#EEF2FF",
  green:"#15803D", greenLight:"#F0FDF4", greenBorder:"#BBF7D0",
  amber:"#B45309", amberLight:"#FFFBEB", amberBorder:"#FDE68A",
  red:"#DC2626", redLight:"#FEF2F2", redBorder:"#FECACA",
  blue:"#1D4ED8", blueLight:"#EFF6FF",
};

const S = {
  card:  { background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"16px", marginBottom:8 },
  label: { fontSize:11, fontWeight:600, color:T.ink3, textTransform:"uppercase", letterSpacing:.7, display:"block", marginBottom:5 },
  input: { width:"100%", border:`1px solid ${T.border}`, borderRadius:8, padding:"9px 12px", fontSize:14, background:T.surface, color:T.ink, boxSizing:"border-box", outline:"none", WebkitAppearance:"none" },
  btn:   { border:"none", borderRadius:8, padding:"8px 16px", fontSize:13, fontWeight:500, cursor:"pointer", display:"inline-flex", alignItems:"center", WebkitTapHighlightColor:"transparent", lineHeight:"1.4" },
  btnP:  { background:T.accent, color:"#fff" },
  btnS:  { background:T.surface, color:T.ink, border:`1px solid ${T.border2}` },
  btnSm: { padding:"6px 12px", fontSize:12 },
  btnD:  { background:T.redLight, color:T.red, border:`1px solid ${T.redBorder}` },
  btnA:  { background:T.amberLight, color:T.amber, border:`1px solid ${T.amberBorder}` },
};

// ─── UTILS ────────────────────────────────────────────────────────────────────
const norm = s => (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");

function wScore(sc, ck){
  if(!sc||!ck||!W[ck]) return 0;
  const w=W[ck]; let tot=0, ws=0;
  CRIT.forEach((c,i)=>{ const v=Number(sc[c.id]||0); tot+=v*w[i]; ws+=w[i]; });
  return ws>0 ? parseFloat((tot/ws).toFixed(2)) : 0;
}

function avgScore(evals, cid, ck){
  const evs=evals.filter(e=>e.candidate_id===cid && e.scores);
  if(!evs.length) return null;
  const scores=evs.map(e=>wScore(e.scores, ck||e.commission_evaluated));
  return parseFloat((scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(2));
}

function mapComm(val){
  const n=norm(val||"").replace(/[^a-z0-9 ]/g," ");
  if(n.includes("logistic")) return "logistica";
  if(n.includes("midia")||n.includes("comunicac")) return "midia";
  if(n.includes("cerimonial")||n.includes("ceremonial")) return "cerimonial";
  if(/\bti\b/.test(n)||n.includes("tecnologia da informacao")) return "ti";
  return "tecnica";
}

// ─── CSV PARSER ───────────────────────────────────────────────────────────────
function parseCSVRows(txt, sep){
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
  txt=(txt||"").replace(/^\uFEFF/,"");
  const sep=txt.split("\n")[0].includes(";")?";":","
  const rows=parseCSVRows(txt,sep);
  if(rows.length<2) return [];
  const hdrs=rows[0].map(h=>h.replace(/^"|"$/g,"").replace(/:+$/,"").trim());
  const fn=kws=>hdrs.findIndex(h=>kws.every(k=>norm(h).includes(k)));
  const iName=fn(["nome","completo"]);
  const iEmail=fn(["e-mail"])!==-1?fn(["e-mail"]):fn(["email"]);
  const iPhone=fn(["telefone"]), iPeriod=fn(["periodo"]), iComm=fn(["comissao","seju"]);
  const iAvail=fn(["disponibilidade"]), iExp=fn(["participou","evento"]);
  const iExtra=fn(["extracurricular"]), iText=fn(["elabore"]);
  const iMatric=fn(["matricula"]), iBirth=fn(["nascimento"]), iCPF=fn(["cpf"]), iRoutine=fn(["rotina"]);
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

// ─── CSV EXPORT ───────────────────────────────────────────────────────────────
function exportCSV(candidates, evaluations, finalStatuses){
  const rows=[["Nome","Matrícula","Período","Email","Comissão","Nota Média","Avaliadores","Status","Observações"]];
  candidates.forEach(c=>{
    const ck=c.commission1;
    const avg=avgScore(evaluations,c.id,ck);
    const fs=finalStatuses.find(f=>f.candidate_id===c.id);
    const obs=evaluations.filter(e=>e.candidate_id===c.id&&e.observations)
      .map(e=>`[${e.evaluator_name}] ${e.observations}`).join(" | ");
    const nEval=evaluations.filter(e=>e.candidate_id===c.id&&e.scores).length;
    rows.push([c.name,c.matricula||"",c.period||"",c.email||"",
      COMMS[ck]?.name||"", avg!=null?avg:"", nEval,
      STATUSES.find(s=>s.id===(fs?.status||"pendente"))?.label||"Pendente",
      obs.replace(/"/g,"'")
    ].map(x=>`"${String(x).replace(/"/g,'""')}"`).join(","));
  });
  const content="\uFEFF"+rows.map(r=>r.join(",")).join("\r\n");
  const blob=new Blob([content],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.setAttribute("href",url); a.setAttribute("download","SEJU_Select.csv");
  a.style.cssText="position:absolute;top:-9999px;left:-9999px";
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); },300);
}

// ─── COMPONENTES BASE ─────────────────────────────────────────────────────────
function useIsMobile(){
  const [m,setM]=useState(false);
  useEffect(()=>{
    const check=()=>setM(window.innerWidth<768);
    check(); window.addEventListener("resize",check);
    return()=>window.removeEventListener("resize",check);
  },[]);
  return m;
}

function Avatar({name,size=34,bg=T.accentLight,color=T.accent}){
  const r=size<=28?50:10;
  return(
    <div style={{width:size,height:size,borderRadius:r,background:bg,color,
      display:"flex",alignItems:"center",justifyContent:"center",
      fontWeight:600,fontSize:Math.round(size*0.38),flexShrink:0}}>
      {(name||"?").charAt(0).toUpperCase()}
    </div>
  );
}

function CommBadge({ck}){
  const c=COMMS[ck]; if(!c) return null;
  return <span style={{background:c.light,color:c.text,padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{c.name}</span>;
}

function SBadge({status}){
  const map={
    pendente:[T.surface3,T.ink2],entrevistado:[T.blueLight,T.blue],
    selecionado:[T.greenLight,T.green],suplente:[T.amberLight,T.amber],
    remanejar:[T.accentLight,T.accent],nao_selecionado:[T.redLight,T.red],descartado:[T.surface3,T.ink3]
  };
  const [bg,tc]=(map[status]||map.pendente);
  return <span style={{background:bg,color:tc,padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{STATUSES.find(s=>s.id===status)?.label||"Pendente"}</span>;
}

function ProgressBar({pct,color}){
  return(
    <div style={{flex:1,height:3,background:T.surface3,borderRadius:99,overflow:"hidden"}}>
      <div style={{width:`${Math.min(100,Math.max(0,pct))}%`,height:"100%",background:color,borderRadius:99}}/>
    </div>
  );
}

function Toast({msg}){
  if(!msg) return null;
  return(
    <div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",
      background:T.ink,color:"#fff",padding:"10px 22px",borderRadius:10,
      fontSize:13,fontWeight:500,zIndex:9999,whiteSpace:"nowrap",
      boxShadow:"0 4px 20px rgba(0,0,0,.25)"}}>
      {msg}
    </div>
  );
}

function Modal({title,subtitle,children,onClose}){
  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,
      background:"rgba(0,0,0,.45)",zIndex:500,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:T.surface,borderRadius:16,padding:24,width:"100%",maxWidth:400,
        boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
        <h3 style={{fontSize:16,fontWeight:600,color:T.ink,margin:"0 0 4px",letterSpacing:"-.3px"}}>{title}</h3>
        {subtitle&&<p style={{fontSize:13,color:T.ink3,margin:"0 0 18px"}}>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({onLogin}){
  const [email,setEmail]=useState("");
  const [pwd,setPwd]=useState("");
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);
  const go=async()=>{
    if(!email||!pwd){ setErr("Preencha email e senha."); return; }
    setLoading(true); setErr("");
    const {data,error}=await supabase.from("users").select("*").eq("email",email.trim()).eq("password",pwd).single();
    setLoading(false);
    if(error||!data) setErr("Email ou senha incorretos.");
    else{ localStorage.setItem("seju_user",JSON.stringify(data)); onLogin(data); }
  };
  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      background:T.surface2,padding:16}}>
      <div style={{...S.card,width:"100%",maxWidth:380,padding:"2rem",marginBottom:0}}>
        <div style={{textAlign:"center",marginBottom:"1.8rem"}}>
          <div style={{width:44,height:44,borderRadius:12,background:T.accent,display:"flex",
            alignItems:"center",justifyContent:"center",fontSize:18,margin:"0 auto 12px"}}>⚖️</div>
          <h1 style={{fontSize:20,fontWeight:600,color:T.ink,margin:0,letterSpacing:"-.4px"}}>SEJU Select</h1>
          <p style={{fontSize:13,color:T.ink3,margin:"4px 0 0"}}>V SEJU 2026.1</p>
        </div>
        <div style={{marginBottom:12}}>
          <label style={S.label}>Email</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&go()} placeholder="seu@email.com" style={S.input}/>
        </div>
        <div style={{marginBottom:16}}>
          <label style={S.label}>Senha</label>
          <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&go()} placeholder="••••••••" style={S.input}/>
        </div>
        {err&&<div style={{background:T.redLight,color:T.red,fontSize:13,padding:"8px 12px",
          borderRadius:8,marginBottom:14}}>{err}</div>}
        <button onClick={go} disabled={loading}
          style={{...S.btn,...S.btnP,width:"100%",justifyContent:"center",padding:"11px",
            fontSize:14,opacity:loading?.7:1}}>
          {loading?"Entrando...":"Entrar"}
        </button>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({candidates,evaluations,finalStatuses,onFilterNav}){
  const isMobile=useIsMobile();
  const discardedIds=useMemo(()=>new Set(finalStatuses.filter(f=>f.status==="descartado").map(f=>f.candidate_id)),[finalStatuses]);
  const evaledIds=useMemo(()=>new Set(evaluations.filter(e=>e.scores&&!discardedIds.has(e.candidate_id)).map(e=>e.candidate_id)),[evaluations,discardedIds]);
  const activeCount=candidates.filter(c=>!discardedIds.has(c.id)).length;
  const stats=[
    {l:"Total inscritos",  v:candidates.length,                vc:T.ink,   sub:`${Object.keys(COMMS).length} comissões`, f:"todos"},
    {l:"Com avaliação",    v:evaledIds.size,                   vc:T.green,  sub:`${candidates.length>0?Math.round(evaledIds.size/candidates.length*100):0}% do total`, f:"avaliado"},
    {l:"Pendentes",        v:activeCount-evaledIds.size,       vc:T.amber,  sub:"aguardando entrevista", f:"pendente"},
    {l:"Selecionados",     v:finalStatuses.filter(f=>f.status==="selecionado").length, vc:T.green, sub:"de 31 vagas", f:"selecionado"},
    {l:"Descartados",      v:discardedIds.size,                vc:T.ink3,   sub:"sem avaliação", f:"descartado"},
  ];
  const byComm=useMemo(()=>Object.entries(COMMS).map(([k,c])=>{
    const inC=candidates.filter(x=>x.commission1===k&&!discardedIds.has(x.id));
    const sel=finalStatuses.filter(f=>{const cd=candidates.find(x=>x.id===f.candidate_id);return cd?.commission1===k&&f.status==="selecionado";}).length;
    const sup=finalStatuses.filter(f=>{const cd=candidates.find(x=>x.id===f.candidate_id);return cd?.commission1===k&&f.status==="suplente";}).length;
    const entrev=new Set(evaluations.filter(e=>inC.some(x=>x.id===e.candidate_id)&&e.scores).map(e=>e.candidate_id)).size;
    return{k,c,total:inC.length,entrev,sel,sup};
  }),[candidates,evaluations,finalStatuses,discardedIds]);

  return(
    <div style={{padding:isMobile?"16px 14px 80px":"28px 32px 48px",maxWidth:800}}>
      <div style={{marginBottom:20}}>
        <h2 style={{fontSize:isMobile?18:22,fontWeight:600,color:T.ink,letterSpacing:"-.4px",margin:"0 0 3px"}}>Dashboard</h2>
        <p style={{fontSize:13,color:T.ink3,margin:0}}>Processo seletivo · tempo real</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(5,1fr)",gap:8,marginBottom:20}}>
        {stats.map(s=>(
          <div key={s.f} onClick={()=>onFilterNav(s.f)}
            style={{...S.card,padding:"14px",marginBottom:0,cursor:"pointer",userSelect:"none",WebkitUserSelect:"none"}}>
            <div style={{fontSize:10,fontWeight:600,color:T.ink3,textTransform:"uppercase",letterSpacing:.7,marginBottom:8}}>{s.l}</div>
            <div style={{fontSize:22,fontWeight:600,color:s.vc,letterSpacing:"-1px",lineHeight:1}}>{s.v}</div>
            <div style={{fontSize:11,color:T.ink3,marginTop:5}}>{s.sub}</div>
            <div style={{fontSize:10,color:T.accent,marginTop:6,fontWeight:600}}>Ver lista →</div>
          </div>
        ))}
      </div>
      <h3 style={{fontSize:13,fontWeight:600,color:T.ink,marginBottom:10}}>Por comissão</h3>
      {byComm.map(({k,c,total,entrev,sel,sup})=>(
        <div key={k} style={{...S.card,padding:0,marginBottom:8}}>
          <div style={{padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",
            borderBottom:`1px solid ${T.border}`,flexWrap:"wrap",gap:6}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <CommBadge ck={k}/>
              <span style={{fontSize:12,color:T.ink3}}>{total} inscrito{total!==1?"s":""}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              {!isMobile&&<span style={{fontSize:11,color:T.ink3}}>🎤 {entrev} · 🟡 {sup} · ⏳ {total-entrev}</span>}
              <span style={{fontSize:13,fontWeight:600,color:T.ink}}>{sel}<span style={{fontWeight:400,color:T.ink3}}>/{c.vagas}</span></span>
            </div>
          </div>
          <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
            <ProgressBar pct={c.vagas>0?Math.round((sel/c.vagas)*100):0} color={c.color}/>
            <span style={{fontSize:11,fontWeight:600,color:c.color,minWidth:30,textAlign:"right"}}>
              {c.vagas>0?Math.round((sel/c.vagas)*100):0}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── CANDIDATOS ───────────────────────────────────────────────────────────────
function CandidatesList({candidates,evaluations,finalStatuses,me,onAdd,onEval,onImport,onDiscard,onRemanejar,onResetEval,dashFilter,onClearFilter}){
  const isMobile=useIsMobile();
  const [search,setSearch]=useState("");
  const [modalCandidate,setModalCandidate]=useState(null);

  const discardedIds=useMemo(()=>new Set(finalStatuses.filter(f=>f.status==="descartado").map(f=>f.candidate_id)),[finalStatuses]);
  const evaledIds=useMemo(()=>new Set(evaluations.filter(e=>e.scores).map(e=>e.candidate_id)),[evaluations]);

  const filtered=useMemo(()=>{
    let list=candidates;
    if(dashFilter==="avaliado")    list=candidates.filter(c=>evaledIds.has(c.id)&&!discardedIds.has(c.id));
    else if(dashFilter==="pendente")    list=candidates.filter(c=>!evaledIds.has(c.id)&&!discardedIds.has(c.id));
    else if(dashFilter==="descartado")  list=candidates.filter(c=>discardedIds.has(c.id));
    else if(dashFilter==="selecionado") list=candidates.filter(c=>finalStatuses.some(f=>f.candidate_id===c.id&&f.status==="selecionado"));
    const q=norm(search);
    if(q) list=list.filter(c=>norm(c.name).includes(q)||norm(c.period||"").includes(q)||norm(c.matricula||"").includes(q));
    return list;
  },[candidates,dashFilter,search,discardedIds,evaledIds,finalStatuses]);

  const byComm=useMemo(()=>Object.entries(COMMS).map(([k,c])=>({
    k,c,list:filtered.filter(x=>x.commission1===k)
  })),[filtered]);

  const filterLabel={todos:"Todos",avaliado:"Com avaliação",pendente:"Pendentes",selecionado:"Selecionados",descartado:"Descartados"}[dashFilter];

  return(
    <div style={{padding:isMobile?"16px 14px 80px":"28px 32px 48px",maxWidth:800}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16,gap:10,flexWrap:"wrap"}}>
        <div>
          <h2 style={{fontSize:isMobile?18:22,fontWeight:600,color:T.ink,letterSpacing:"-.4px",margin:"0 0 3px"}}>Candidatos</h2>
          <p style={{fontSize:13,color:T.ink3,margin:0}}>{candidates.length} inscritos</p>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {me.is_admin&&(
            <label style={{...S.btn,...S.btnS,...S.btnSm,cursor:"pointer"}}>
              {isMobile?"↓ CSV":"↓ Importar CSV"}
              <input type="file" accept=".csv,.txt" style={{display:"none"}}
                onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>onImport(ev.target.result);r.readAsText(f,"UTF-8");e.target.value="";}}/>
            </label>
          )}
          {me.is_admin&&(
            <button onClick={onAdd} style={{...S.btn,...S.btnP,...S.btnSm}}>
              {isMobile?"+ Novo":"+ Novo candidato"}
            </button>
          )}
        </div>
      </div>

      {/* Filtro ativo */}
      {filterLabel&&(
        <div style={{background:T.accentLight,border:`1px solid ${T.accent}44`,borderRadius:8,
          padding:"8px 14px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:12,color:T.accent,fontWeight:500}}>
            Filtrando: <strong>{filterLabel}</strong> · {filtered.length} candidato{filtered.length!==1?"s":""}
          </span>
          <button onClick={onClearFilter}
            style={{...S.btn,background:"none",border:"none",color:T.accent,fontSize:12,padding:"2px 6px",fontWeight:700}}>
            ✕ Limpar
          </button>
        </div>
      )}

      {/* Busca */}
      <div style={{display:"flex",alignItems:"center",gap:8,background:T.surface,
        border:`1px solid ${T.border}`,borderRadius:8,padding:"0 14px",height:40,marginBottom:20}}>
        <span style={{color:T.ink3,fontSize:15}}>⌕</span>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Buscar por nome, matrícula ou período..."
          style={{border:"none",outline:"none",fontSize:14,color:T.ink,background:"transparent",flex:1,minWidth:0}}/>
      </div>

      {/* Sem candidatos */}
      {candidates.length===0&&(
        <div style={{textAlign:"center",padding:"56px 0",color:T.ink3}}>
          <div style={{fontSize:40,marginBottom:12,opacity:.35}}>📭</div>
          <p style={{fontSize:14,margin:0}}>Nenhum candidato cadastrado.</p>
          <p style={{fontSize:12,margin:"4px 0 0"}}>Importe um CSV ou adicione manualmente.</p>
        </div>
      )}

      {/* Lista por comissão */}
      {byComm.map(({k,c,list})=>{
        if(!list.length) return null;
        return(
          <div key={k} style={{marginBottom:24}}>
            <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:10,
              borderBottom:`1px solid ${T.border}`,marginBottom:8}}>
              <div style={{width:3,height:14,borderRadius:99,background:c.color,flexShrink:0}}/>
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
              const hasEvals=allEvals.length>0;
              return(
                <div key={cd.id} style={{...S.card,opacity:st==="descartado"?.45:1,padding:"12px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    {!isMobile&&<Avatar name={cd.name} bg={c.light} color={c.text}/>}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:500,color:T.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cd.name}</div>
                      <div style={{fontSize:11,color:T.ink3,marginTop:2}}>
                        {cd.period||"—"}{cd.matricula?` · ${cd.matricula}`:""}
                      </div>
                      {hasEvals&&<div style={{fontSize:11,color:T.ink3,marginTop:2}}>{allEvals.length} aval. · média <strong style={{color:T.accent}}>{avg}</strong></div>}
                      {cd.remanejado_de&&<div style={{fontSize:10,color:T.amber,marginTop:2}}>↪ de {COMMS[cd.remanejado_de]?.name||cd.remanejado_de}</div>}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end"}}>
                      <SBadge status={st}/>
                      {st!=="descartado"&&(
                        <>
                          {me.is_admin&&!isMobile&&(
                            <button onClick={()=>setModalCandidate(cd)} style={{...S.btn,...S.btnA,...S.btnSm}}>↪ Remanejar</button>
                          )}
                          {me.is_admin&&st==="pendente"&&!isMobile&&(
                            <button onClick={()=>onDiscard(cd.id)} style={{...S.btn,...S.btnD,...S.btnSm}}>Descartar</button>
                          )}
                          <button onClick={()=>onEval(cd)}
                            style={{...S.btn,...S.btnSm,
                              ...(myEval?.scores?{background:T.greenLight,color:T.green,border:`1px solid ${T.greenBorder}`}:S.btnP),
                              whiteSpace:"nowrap"}}>
                            {myEval?.scores?(isMobile?"Ver":"Ver avaliação"):(isMobile?"Avaliar":"Iniciar entrevista")}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Ações admin mobile */}
                  {me.is_admin&&st!=="descartado"&&isMobile&&(
                    <div style={{display:"flex",gap:6,marginTop:10,paddingTop:10,borderTop:`1px solid ${T.border}`}}>
                      <button onClick={()=>setModalCandidate(cd)} style={{...S.btn,...S.btnA,...S.btnSm,flex:1,justifyContent:"center"}}>↪ Remanejar</button>
                      {st==="pendente"&&<button onClick={()=>onDiscard(cd.id)} style={{...S.btn,...S.btnD,...S.btnSm,flex:1,justifyContent:"center"}}>Descartar</button>}
                    </div>
                  )}
                  {/* Zerar notas - admin */}
                  {me.is_admin&&hasEvals&&(
                    <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${T.border}`,textAlign:"right"}}>
                      <button onClick={()=>{if(window.confirm(`Zerar TODAS as notas de ${cd.name}?\nEssa ação não pode ser desfeita.`)) onResetEval(cd.id);}}
                        style={{...S.btn,...S.btnSm,background:T.redLight,color:T.red,border:`1px solid ${T.redBorder}`,fontSize:11}}>
                        ✕ Zerar notas (Admin)
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Modal remanejar */}
      {modalCandidate&&(
        <RemanejModal candidate={modalCandidate}
          onConfirm={target=>{ onRemanejar(modalCandidate.id,target); setModalCandidate(null); }}
          onClose={()=>setModalCandidate(null)}/>
      )}
    </div>
  );
}

// ─── MODAL REMANEJAR ──────────────────────────────────────────────────────────
function RemanejModal({candidate,onConfirm,onClose}){
  const [target,setTarget]=useState("");
  const currentComm=candidate.commission1||"tecnica";
  const opts=Object.entries(COMMS).filter(([k])=>k!==currentComm);
  return(
    <Modal title="Remanejar candidato"
      subtitle={`${candidate.name} está em ${COMMS[currentComm]?.name||currentComm}`}
      onClose={onClose}>
      <label style={S.label}>Mover para a comissão</label>
      <select value={target} onChange={e=>setTarget(e.target.value)} style={{...S.input,marginBottom:20}}>
        <option value="">Selecione a nova comissão...</option>
        {opts.map(([k,c])=><option key={k} value={k}>{c.name}</option>)}
      </select>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
        <button onClick={onClose} style={{...S.btn,...S.btnS}}>Cancelar</button>
        <button onClick={()=>target&&onConfirm(target)} disabled={!target}
          style={{...S.btn,...S.btnP,opacity:target?1:.5}}>
          Confirmar
        </button>
      </div>
    </Modal>
  );
}

// ─── FORM NOVO CANDIDATO ──────────────────────────────────────────────────────
function CandidateForm({onSave,onBack}){
  const isMobile=useIsMobile();
  const [f,setF]=useState({name:"",email:"",phone:"",period:"",matricula:"",commission1:"tecnica"});
  const upd=(k,v)=>setF(p=>({...p,[k]:v}));
  return(
    <div style={{padding:isMobile?"16px 14px 80px":"28px 32px",maxWidth:600}}>
      <button onClick={onBack} style={{...S.btn,background:"none",border:"none",color:T.ink3,padding:"0 0 16px",fontSize:13}}>← Voltar</button>
      <h2 style={{fontSize:isMobile?18:20,fontWeight:600,color:T.ink,margin:"0 0 20px",letterSpacing:"-.4px"}}>Novo candidato</h2>
      <div style={{...S.card,padding:20}}>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>
          <div style={{gridColumn:"1 / -1"}}>
            <label style={S.label}>Nome completo</label>
            <input value={f.name} onChange={e=>upd("name",e.target.value)} style={S.input} placeholder="Nome do candidato"/>
          </div>
          {[{k:"email",l:"Email",ph:"email@exemplo.com"},{k:"phone",l:"Telefone",ph:"(84) 9 9999-9999"},
            {k:"period",l:"Período / Turno",ph:"5º - matutino"},{k:"matricula",l:"Matrícula",ph:"20231001"}].map(x=>(
            <div key={x.k}>
              <label style={S.label}>{x.l}</label>
              <input value={f[x.k]||""} onChange={e=>upd(x.k,e.target.value)} placeholder={x.ph} style={S.input}/>
            </div>
          ))}
          <div style={{gridColumn:"1 / -1"}}>
            <label style={S.label}>Comissão</label>
            <select value={f.commission1} onChange={e=>upd("commission1",e.target.value)} style={S.input}>
              {Object.entries(COMMS).map(([k,c])=><option key={k} value={k}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}>
          <button onClick={onBack} style={{...S.btn,...S.btnS}}>Cancelar</button>
          <button onClick={()=>f.name&&onSave(f)} disabled={!f.name}
            style={{...S.btn,...S.btnP,opacity:f.name?1:.5}}>Cadastrar</button>
        </div>
      </div>
    </div>
  );
}

// ─── FICHA DE AVALIAÇÃO ───────────────────────────────────────────────────────
function EvaluateForm({candidate,myEval,me,allEvals,onSave,onBack}){
  const isMobile=useIsMobile();
  const [scores,setScores]=useState(myEval?.scores||{});
  const [obs,setObs]=useState(myEval?.observations||"");
  const [ck,setCk]=useState(myEval?.commission_evaluated||candidate.commission1||"tecnica");
  const [saving,setSaving]=useState(false);
  const setS=(id,v)=>setScores(p=>({...p,[id]:Math.max(0,Math.min(10,Number(v)))}));
  const myScore=useMemo(()=>wScore(scores,ck),[scores,ck]);
  const avgAll=useMemo(()=>avgScore(allEvals,candidate.id,ck),[allEvals,candidate.id,ck]);
  const w=W[ck]||W.tecnica;
  const comm=COMMS[ck]||COMMS.tecnica;
  const lbl=myScore>=8?"Excelente":myScore>=6.5?"Bom":myScore>=5?"Regular":myScore>0?"Baixo":"—";
  const lblColor=myScore>=8?T.green:myScore>=6.5?T.accent:myScore>=5?T.amber:T.red;
  const peers=allEvals.filter(e=>e.evaluator_id!==me.id&&e.scores);

  return(
    <div style={{padding:isMobile?"16px 14px 80px":"28px 32px 48px",maxWidth:680}}>
      <button onClick={onBack} style={{...S.btn,background:"none",border:"none",color:T.ink3,padding:"0 0 16px",fontSize:13}}>← Candidatos</button>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,gap:10,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <Avatar name={candidate.name} size={40} bg={comm.light} color={comm.text}/>
          <div>
            <h2 style={{fontSize:isMobile?16:18,fontWeight:600,color:T.ink,margin:"0 0 2px",letterSpacing:"-.3px"}}>{candidate.name}</h2>
            <p style={{fontSize:12,color:T.ink3,margin:0}}>Avaliação de <strong style={{color:T.ink}}>{me.name}</strong></p>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:30,fontWeight:600,color:T.accent,letterSpacing:"-1.5px"}}>{myScore.toFixed(2)}</div>
          <div style={{fontSize:11,fontWeight:600,color:lblColor}}>{lbl}</div>
        </div>
      </div>

      {/* Dados do formulário */}
      <div style={{...S.card,background:comm.light,border:`1px solid ${comm.color}22`,padding:"14px 16px",marginBottom:12}}>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(3,1fr)",gap:10,marginBottom:10}}>
          {[{l:"Período",v:candidate.period},{l:"Matrícula",v:candidate.matricula},
            {l:"Disponibilidade",v:candidate.availability},{l:"Nascimento",v:candidate.birthdate},
            {l:"CPF",v:candidate.cpf},{l:"Telefone",v:candidate.phone}
          ].filter(x=>x.v).map(x=>(
            <div key={x.l}>
              <div style={{fontSize:10,color:T.ink3,textTransform:"uppercase",letterSpacing:.7,marginBottom:2}}>{x.l}</div>
              <div style={{fontSize:12,fontWeight:500,color:T.ink}}>{x.v}</div>
            </div>
          ))}
        </div>
        {[{l:"Experiência em eventos",v:candidate.event_exp},{l:"Extracurriculares",v:candidate.skills},
          {l:"Rotina",v:candidate.routine},{l:"Texto motivacional",v:candidate.notes}
        ].filter(x=>x.v).map(x=>(
          <div key={x.l} style={{paddingTop:10,borderTop:`1px solid ${comm.color}22`,marginTop:8}}>
            <div style={{fontSize:10,color:T.ink3,textTransform:"uppercase",letterSpacing:.7,marginBottom:4}}>{x.l}</div>
            <div style={{fontSize:12,color:T.ink,lineHeight:1.7,maxHeight:80,overflowY:"auto"}}>{x.v}</div>
          </div>
        ))}
      </div>

      {/* Avaliações de pares */}
      {peers.length>0&&(
        <div style={{...S.card,padding:"14px 16px",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <span style={{fontSize:12,fontWeight:600,color:T.ink}}>Avaliações dos colegas</span>
            {avgAll!==null&&<span style={{fontSize:12,color:T.ink3}}>Média: <strong style={{color:T.accent}}>{avgAll}</strong></span>}
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

      {/* Comissão */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
        <span style={{fontSize:12,color:T.ink2}}>Avaliando para:</span>
        <select value={ck} onChange={e=>setCk(e.target.value)} style={{...S.input,width:"auto",padding:"5px 10px",fontSize:12}}>
          {Object.entries(COMMS).map(([k,c])=><option key={k} value={k}>{c.name}</option>)}
        </select>
      </div>

      {/* Critérios */}
      <div style={{...S.card,padding:"16px 18px",marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:600,color:T.ink,marginBottom:12}}>Critérios <span style={{fontWeight:400,color:T.ink3}}>(0–10)</span></div>
        {CRIT.map((c,i)=>{
          const wt=w[i]; const hi=wt>=2; const val=scores[c.id]||0;
          return(
            <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",
              borderBottom:`1px solid ${T.border}`,flexWrap:isMobile?"wrap":"nowrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,minWidth:isMobile?"100%":"auto",flex:isMobile?undefined:1}}>
                <span style={{fontSize:12,color:T.ink2}}>{c.label}</span>
                {hi&&<span style={{fontSize:10,background:T.accentLight,color:T.accent,padding:"2px 6px",borderRadius:99,fontWeight:600}}>Peso {wt}×</span>}
              </div>
              <div style={{flex:1,height:3,background:T.surface3,borderRadius:99,overflow:"hidden",minWidth:60}}>
                <div style={{width:`${val*10}%`,height:"100%",background:val>=7?T.green:val>=5?T.amber:T.red,borderRadius:99}}/>
              </div>
              <input type="range" min="0" max="10" step="1" value={val}
                onChange={e=>setS(c.id,e.target.value)} style={{width:isMobile?80:80,accentColor:T.accent,flexShrink:0}}/>
              <input type="number" min="0" max="10" value={val}
                onChange={e=>setS(c.id,e.target.value)}
                style={{...S.input,width:42,textAlign:"center",padding:"4px 0",fontSize:13,fontWeight:600}}/>
            </div>
          );
        })}
      </div>

      {/* Observações */}
      <div style={{...S.card,padding:"14px 16px",marginBottom:16}}>
        <label style={S.label}>Minhas observações</label>
        <textarea rows={3} value={obs} onChange={e=>setObs(e.target.value)}
          placeholder="Pontos fortes, fracos, comportamento..."
          style={{...S.input,resize:"none"}}/>
      </div>

      <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
        <button onClick={onBack} style={{...S.btn,...S.btnS}}>Cancelar</button>
        <button onClick={async()=>{setSaving(true);await onSave({scores,observations:obs,commission_evaluated:ck});setSaving(false);}}
          style={{...S.btn,...S.btnP}}>
          {saving?"Salvando...":"Salvar avaliação →"}
        </button>
      </div>
    </div>
  );
}

// ─── STATUS FINAL (admin) ─────────────────────────────────────────────────────
function FinalStatusPanel({candidate,finalStatus,evaluations,me,onSave}){
  const [st,setSt]=useState(finalStatus?.status||"pendente");
  if(!me.is_admin) return null;
  const avg=avgScore(evaluations,candidate.id,candidate.commission1);
  const nEval=evaluations.filter(e=>e.candidate_id===candidate.id&&e.scores).length;
  return(
    <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${T.border}`}}>
      <div style={{fontSize:11,fontWeight:600,color:T.accent,marginBottom:8}}>
        Status final (Admin) · {nEval} aval. · Média: <strong>{avg??"—"}</strong>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
        {STATUSES.filter(s=>s.id!=="pendente").map(s=>(
          <button key={s.id} onClick={()=>setSt(s.id)}
            style={{...S.btn,...S.btnSm,
              background:st===s.id?T.accent:T.surface,
              color:st===s.id?"#fff":T.ink2,
              border:`1px solid ${st===s.id?T.accent:T.border}`}}>
            {s.label}
          </button>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <button onClick={()=>onSave(st)} style={{...S.btn,...S.btnSm,background:T.green,color:"#fff",border:"none"}}>
          Confirmar status
        </button>
        {finalStatus?.set_by_name&&<span style={{fontSize:11,color:T.ink3}}>por {finalStatus.set_by_name}</span>}
      </div>
    </div>
  );
}

// ─── RANKINGS ─────────────────────────────────────────────────────────────────
function Rankings({candidates,evaluations,finalStatuses,me,onSetFinal,initComm}){
  const isMobile=useIsMobile();
  const [active,setActive]=useState(initComm||"tecnica");
  const discardedIds=useMemo(()=>new Set(finalStatuses.filter(f=>f.status==="descartado").map(f=>f.candidate_id)),[finalStatuses]);
  const vagas=COMMS[active]?.vagas||0;
  const ranking=useMemo(()=>candidates
    .filter(c=>c.commission1===active&&!discardedIds.has(c.id))
    .map(c=>({...c,
      fs:finalStatuses.find(f=>f.candidate_id===c.id),
      evs:evaluations.filter(e=>e.candidate_id===c.id&&e.scores),
      avg:avgScore(evaluations,c.id,active)??0
    }))
    .sort((a,b)=>b.avg-a.avg)
  ,[candidates,evaluations,finalStatuses,active,discardedIds]);

  return(
    <div style={{padding:isMobile?"16px 14px 80px":"28px 32px 48px",maxWidth:800}}>
      <div style={{marginBottom:18}}>
        <h2 style={{fontSize:isMobile?18:22,fontWeight:600,color:T.ink,letterSpacing:"-.4px",margin:"0 0 3px"}}>Rankings</h2>
        <p style={{fontSize:13,color:T.ink3,margin:0}}>Média simples entre todos os avaliadores</p>
      </div>
      {/* Tabs com scroll horizontal */}
      <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",marginBottom:16}}>
        <div style={{display:"flex",gap:3,background:T.surface3,padding:3,borderRadius:10,
          border:`1px solid ${T.border}`,width:"max-content",minWidth:"100%"}}>
          {Object.entries(COMMS).map(([k,c])=>{
            const sel=finalStatuses.filter(f=>{const cd=candidates.find(x=>x.id===f.candidate_id);return cd?.commission1===k&&f.status==="selecionado";}).length;
            return(
              <button key={k} onClick={()=>setActive(k)}
                style={{...S.btn,...S.btnSm,border:"none",flexShrink:0,
                  background:active===k?T.surface:"transparent",
                  color:active===k?T.ink:T.ink3,
                  boxShadow:active===k?"0 1px 3px rgba(0,0,0,.08)":"none"}}>
                {isMobile?c.name.split(" ")[0]:c.name}
                <span style={{color:T.ink3,fontSize:11,marginLeft:4}}>{sel}/{c.vagas}</span>
              </button>
            );
          })}
        </div>
      </div>

      {ranking.length===0?(
        <div style={{textAlign:"center",padding:"56px 0",color:T.ink3}}>
          <div style={{fontSize:36,opacity:.35,marginBottom:10}}>📊</div>
          <p style={{fontSize:14,margin:0}}>Nenhum candidato avaliado para esta comissão</p>
        </div>
      ):(
        <div>
          {ranking.map((c,i)=>{
            const isSel=i<vagas; const isSup=i>=vagas&&i<vagas+Math.ceil(vagas*0.5);
            const posColor=i===0?"#B45309":i===1?T.ink3:i===2?"#92400E":T.border2;
            return(
              <div key={c.id} style={{...S.card,padding:"13px 14px",
                background:isSel?T.greenLight:"#fff",
                borderColor:isSel?T.greenBorder:isSup?T.amberBorder:T.border}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{fontSize:13,fontWeight:600,color:posColor,width:26,textAlign:"center",flexShrink:0}}>{i+1}°</div>
                  {!isMobile&&<Avatar name={c.name} size={30} bg={COMMS[active].light} color={COMMS[active].text}/>}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,color:T.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
                    <div style={{fontSize:11,color:T.ink3}}>{c.period||"—"}{!isMobile&&c.matricula?` · ${c.matricula}`:""}</div>
                    {!isMobile&&c.evs.length>0&&(
                      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:4}}>
                        {c.evs.map(e=>(
                          <span key={e.id} style={{fontSize:10,background:T.surface3,border:`1px solid ${T.border}`,
                            color:T.ink2,padding:"2px 7px",borderRadius:99}}>
                            {e.evaluator_name}: <strong>{wScore(e.scores,active).toFixed(2)}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                    {isSel&&<span style={{fontSize:10,background:T.greenLight,color:T.green,padding:"2px 7px",borderRadius:99,fontWeight:600,border:`1px solid ${T.greenBorder}`}}>✓</span>}
                    {isSup&&<span style={{fontSize:10,background:T.amberLight,color:T.amber,padding:"2px 7px",borderRadius:99,fontWeight:600,border:`1px solid ${T.amberBorder}`}}>Sup.</span>}
                    {!isMobile&&<SBadge status={c.fs?.status||"pendente"}/>}
                    <span style={{fontSize:18,fontWeight:600,color:T.accent,letterSpacing:"-1px",minWidth:38,textAlign:"right"}}>{c.avg.toFixed(2)}</span>
                  </div>
                </div>
                <FinalStatusPanel candidate={c} finalStatus={c.fs} evaluations={evaluations} me={me}
                  onSave={st=>onSetFinal(c.id,st,c.commission1)}/>
              </div>
            );
          })}
          <p style={{fontSize:11,color:T.ink3,textAlign:"center",marginTop:10}}>{COMMS[active]?.name} · {vagas} vagas</p>
        </div>
      )}
    </div>
  );
}

// ─── AVALIADORES ──────────────────────────────────────────────────────────────
function Users({users,me,onAdd,onDel}){
  const isMobile=useIsMobile();
  const [form,setForm]=useState({name:"",email:"",password:"seju2025",leads_commission:"",is_admin:false});
  const [adding,setAdding]=useState(false);
  const [saving,setSaving]=useState(false);
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));
  const submit=async()=>{
    if(!form.name||!form.email) return;
    setSaving(true); await onAdd(form); setSaving(false);
    setForm({name:"",email:"",password:"seju2025",leads_commission:"",is_admin:false});
    setAdding(false);
  };
  return(
    <div style={{padding:isMobile?"16px 14px 80px":"28px 32px 48px",maxWidth:640}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20,gap:10}}>
        <div>
          <h2 style={{fontSize:isMobile?18:22,fontWeight:600,color:T.ink,letterSpacing:"-.4px",margin:"0 0 3px"}}>Avaliadores</h2>
          <p style={{fontSize:13,color:T.ink3,margin:0}}>{(users||[]).length} membros da Comissão Geral</p>
        </div>
        {me.is_admin&&(
          <button onClick={()=>setAdding(p=>!p)} style={{...S.btn,...S.btnP,...S.btnSm,flexShrink:0}}>
            {adding?"Cancelar":"+ Novo membro"}
          </button>
        )}
      </div>

      {adding&&me.is_admin&&(
        <div style={{...S.card,padding:20,marginBottom:14}}>
          <h3 style={{fontSize:13,fontWeight:600,color:T.ink,marginBottom:14}}>Cadastrar avaliador</h3>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
            <div style={{gridColumn:"1 / -1"}}>
              <label style={S.label}>Nome</label>
              <input value={form.name} onChange={e=>upd("name",e.target.value)} placeholder="Nome completo" style={S.input}/>
            </div>
            <div>
              <label style={S.label}>Email</label>
              <input type="email" value={form.email} onChange={e=>upd("email",e.target.value)} placeholder="email@seju.com" style={S.input}/>
            </div>
            <div>
              <label style={S.label}>Senha inicial</label>
              <input type="password" value={form.password} onChange={e=>upd("password",e.target.value)} placeholder="seju2025" style={S.input}/>
            </div>
            <div style={{gridColumn:"1 / -1"}}>
              <label style={S.label}>Lidera comissão</label>
              <select value={form.leads_commission||""} onChange={e=>upd("leads_commission",e.target.value)} style={S.input}>
                <option value="">Apenas avaliador</option>
                {Object.entries(COMMS).map(([k,c])=><option key={k} value={k}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,margin:"12px 0"}}>
            <input type="checkbox" id="adm" checked={form.is_admin} onChange={e=>upd("is_admin",e.target.checked)}/>
            <label htmlFor="adm" style={{fontSize:13,color:T.ink2}}>Admin — gerencia membros e define status final</label>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <button onClick={()=>setAdding(false)} style={{...S.btn,...S.btnS}}>Cancelar</button>
            <button onClick={submit} disabled={!form.name||!form.email||saving}
              style={{...S.btn,...S.btnP,opacity:form.name&&form.email?1:.5}}>
              {saving?"Salvando...":"Cadastrar"}
            </button>
          </div>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {(users||[]).map(u=>(
          <div key={u.id} style={{...S.card,display:"flex",alignItems:"center",gap:12,padding:"13px 16px"}}>
            <Avatar name={u.name} size={36} bg={T.accentLight} color={T.accent}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:500,color:T.ink,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                {u.name}
                {u.is_admin&&<span style={{fontSize:10,background:T.accentLight,color:T.accent,padding:"2px 7px",borderRadius:99,fontWeight:600}}>Admin</span>}
                {u.id===me.id&&<span style={{fontSize:10,background:T.surface3,color:T.ink3,padding:"2px 7px",borderRadius:99}}>Você</span>}
              </div>
              <div style={{fontSize:11,color:T.ink3,marginTop:2}}>{u.email}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              {u.leads_commission&&<CommBadge ck={u.leads_commission}/>}
              {me.is_admin&&u.id!==me.id&&(
                <button onClick={()=>onDel(u.id)}
                  style={{...S.btn,...S.btnSm,background:"none",border:"none",color:T.red,fontSize:12}}>
                  Remover
                </button>
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
  const isMobile=useIsMobile();
  const discardedIds=useMemo(()=>new Set(finalStatuses.filter(f=>f.status==="descartado").map(f=>f.candidate_id)),[finalStatuses]);
  const byComm=useMemo(()=>{
    const res={};
    Object.keys(COMMS).forEach(k=>{
      res[k]=candidates
        .filter(c=>c.commission1===k&&!discardedIds.has(c.id))
        .map(c=>({...c,
          avg:avgScore(evaluations,c.id,k),
          evs:evaluations.filter(e=>e.candidate_id===c.id&&e.scores),
          fs:finalStatuses.find(f=>f.candidate_id===c.id)
        }))
        .sort((a,b)=>(b.avg??0)-(a.avg??0));
    });
    return res;
  },[candidates,evaluations,finalStatuses,discardedIds]);
  const totSel=finalStatuses.filter(f=>f.status==="selecionado").length;
  const totSup=finalStatuses.filter(f=>f.status==="suplente").length;
  return(
    <div style={{padding:isMobile?"16px 14px 80px":"28px 32px 48px",maxWidth:800}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20,gap:10,flexWrap:"wrap"}}>
        <div>
          <h2 style={{fontSize:isMobile?18:22,fontWeight:600,color:T.ink,letterSpacing:"-.4px",margin:"0 0 3px"}}>Exportar resultados</h2>
          <p style={{fontSize:13,color:T.ink3,margin:0}}>{totSel} selecionados · {totSup} suplentes</p>
        </div>
        <button onClick={()=>exportCSV(candidates,evaluations,finalStatuses)}
          style={{...S.btn,background:T.green,color:"#fff",...S.btnSm,flexShrink:0,border:"none"}}>
          ↓ Baixar CSV completo
        </button>
      </div>
      {Object.entries(byComm).map(([k,list])=>{
        if(!list.length) return null;
        const vagas=COMMS[k].vagas;
        return(
          <div key={k} style={{...S.card,overflow:"hidden",padding:0,marginBottom:12}}>
            <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,
              display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <CommBadge ck={k}/>
              <span style={{fontSize:11,color:T.ink3}}>{vagas} vagas · {list.length} candidatos</span>
            </div>
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              <table style={{width:"100%",fontSize:12,borderCollapse:"collapse",minWidth:420}}>
                <thead><tr style={{background:T.surface2}}>
                  {["#","Nome","Matrícula","Período","Nota","Aval.","Status"].map(h=>(
                    <th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:10,fontWeight:600,
                      color:T.ink3,textTransform:"uppercase",letterSpacing:.6,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {list.map((c,i)=>(
                    <tr key={c.id} style={{borderTop:`1px solid ${T.border}`,background:i<vagas?T.greenLight:"#fff"}}>
                      <td style={{padding:"9px 12px",color:T.ink3,fontWeight:600}}>{i+1}</td>
                      <td style={{padding:"9px 12px",fontWeight:500,color:T.ink,whiteSpace:"nowrap"}}>{c.name}</td>
                      <td style={{padding:"9px 12px",color:T.ink2}}>{c.matricula||"—"}</td>
                      <td style={{padding:"9px 12px",color:T.ink2,whiteSpace:"nowrap"}}>{c.period||"—"}</td>
                      <td style={{padding:"9px 12px",fontWeight:600,color:T.accent}}>{c.avg?.toFixed(2)??"—"}</td>
                      <td style={{padding:"9px 12px",color:T.ink2}}>{c.evs.length}</td>
                      <td style={{padding:"9px 12px"}}><SBadge status={c.fs?.status||"pendente"}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      {Object.values(byComm).every(l=>l.length===0)&&(
        <div style={{textAlign:"center",padding:"56px 0",color:T.ink3}}>
          <div style={{fontSize:36,opacity:.35,marginBottom:10}}>📋</div>
          <p style={{fontSize:14,margin:0}}>Nenhuma avaliação registrada ainda</p>
        </div>
      )}
    </div>
  );
}

// ─── LAYOUT ───────────────────────────────────────────────────────────────────
const NAV=[
  {id:"dashboard", icon:"▣", label:"Dashboard",  section:"Visão geral"},
  {id:"candidates",icon:"◎", label:"Candidatos",  section:null},
  {id:"rankings",  icon:"↑", label:"Rankings",    section:"Seleção"},
  {id:"users",     icon:"◇", label:"Avaliadores", section:null},
  {id:"export",    icon:"↓", label:"Exportar",    section:"Dados"},
];

function Layout({me,page,onNav,onLogout,children}){
  const isMobile=useIsMobile();
  if(isMobile) return(
    <div style={{display:"flex",flexDirection:"column",minHeight:"100vh",background:T.surface2}}>
      <header style={{background:T.surface,borderBottom:`1px solid ${T.border}`,
        padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",
        position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:28,height:28,borderRadius:8,background:T.accent,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>⚖️</div>
          <div style={{fontSize:13,fontWeight:600,color:T.ink,letterSpacing:"-.3px"}}>SEJU Select</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <Avatar name={me.name} size={28} bg={T.accentLight} color={T.accent}/>
          <button onClick={onLogout} style={{...S.btn,background:"none",border:"none",fontSize:12,color:T.ink3,padding:"4px 8px"}}>↩</button>
        </div>
      </header>
      <main style={{flex:1,overflowY:"auto"}}>{children}</main>
      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:T.surface,
        borderTop:`1px solid ${T.border}`,display:"flex",zIndex:100}}>
        {NAV.map(n=>(
          <div key={n.id} onClick={()=>onNav(n.id)}
            style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",
              justifyContent:"center",padding:"10px 4px 8px",cursor:"pointer",
              color:page===n.id?T.accent:T.ink3,
              borderTop:page===n.id?`2px solid ${T.accent}`:"2px solid transparent"}}>
            <span style={{fontSize:17,lineHeight:1}}>{n.icon}</span>
            <span style={{fontSize:9,fontWeight:600,marginTop:3}}>{n.label}</span>
          </div>
        ))}
      </nav>
    </div>
  );
  return(
    <div style={{display:"flex",minHeight:"100vh",background:T.surface2}}>
      <aside style={{width:220,flexShrink:0,background:T.surface,borderRight:`1px solid ${T.border}`,
        display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh",overflowY:"auto"}}>
        <div style={{padding:"20px 18px 16px",borderBottom:`1px solid ${T.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,borderRadius:9,background:T.accent,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>⚖️</div>
            <div>
              <div style={{fontSize:14,fontWeight:600,color:T.ink,letterSpacing:"-.3px"}}>SEJU Select</div>
              <div style={{fontSize:11,color:T.ink3,marginTop:1}}>V SEJU 2026.1</div>
            </div>
          </div>
        </div>
        <nav style={{flex:1,padding:"8px 8px"}}>
          {NAV.map(n=>(
            <div key={n.id}>
              {n.section&&<div style={{fontSize:10,fontWeight:600,color:T.ink3,letterSpacing:.8,
                textTransform:"uppercase",padding:"14px 8px 5px"}}>{n.section}</div>}
              <div onClick={()=>onNav(n.id)}
                style={{display:"flex",alignItems:"center",gap:9,padding:"8px 10px",borderRadius:8,
                  cursor:"pointer",fontSize:13,fontWeight:500,marginBottom:2,
                  background:page===n.id?T.accentLight:"transparent",
                  color:page===n.id?T.accent:T.ink2}}>
                <span style={{fontSize:13,opacity:page===n.id?1:.6}}>{n.icon}</span>
                {n.label}
              </div>
            </div>
          ))}
        </nav>
        <div style={{padding:"10px 8px",borderTop:`1px solid ${T.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:8,marginBottom:4}}>
            <Avatar name={me.name} size={28} bg={T.accentLight} color={T.accent}/>
            <div style={{minWidth:0}}>
              <div style={{fontSize:12,fontWeight:500,color:T.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{me.name}</div>
              <div style={{fontSize:10,color:T.ink3}}>{me.is_admin?"Admin":"Avaliador"}{me.leads_commission?` · ${COMMS[me.leads_commission]?.name}`:""}</div>
            </div>
          </div>
          <div onClick={onLogout} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",
            borderRadius:8,cursor:"pointer",fontSize:12,color:T.ink3}}>
            <span>↩</span><span>Sair</span>
          </div>
        </div>
      </aside>
      <main style={{flex:1,overflowY:"auto"}}>{children}</main>
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
export default function App(){
  const [me,setMe]=useState(()=>{
    try{ const s=localStorage.getItem("seju_user"); return s?JSON.parse(s):null; }catch{ return null; }
  });
  const [page,setPage]=useState("dashboard");
  const [users,setUsers]=useState([]);
  const [candidates,setCandidates]=useState([]);
  const [evaluations,setEvaluations]=useState([]);
  const [finalStatuses,setFinalStatuses]=useState([]);
  const [evalCandidate,setEvalCandidate]=useState(null);
  const [rankComm,setRankComm]=useState(null);
  const [addingCandidate,setAddingCandidate]=useState(false);
  const [dashFilter,setDashFilter]=useState(null);
  const [loading,setLoading]=useState(false);
  const [toast,setToast]=useState("");

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
    const ch1=supabase.channel("rt-ev").on("postgres_changes",{event:"*",schema:"public",table:"evaluations"},()=>
      supabase.from("evaluations").select("*").then(r=>{ if(r.data) setEvaluations(r.data); })).subscribe();
    const ch2=supabase.channel("rt-fs").on("postgres_changes",{event:"*",schema:"public",table:"final_status"},()=>
      supabase.from("final_status").select("*").then(r=>{ if(r.data) setFinalStatuses(r.data); })).subscribe();
    const ch3=supabase.channel("rt-cd").on("postgres_changes",{event:"*",schema:"public",table:"candidates"},()=>
      supabase.from("candidates").select("*").order("name").then(r=>{ if(r.data) setCandidates(r.data); })).subscribe();
    return()=>{ supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3); };
  },[me,loadAll]);

  const nav=useCallback(p=>{
    setPage(p);
    if(p!=="candidates") setDashFilter(null);
    if(p!=="rankings") setRankComm(null);
    setAddingCandidate(false);
    setEvalCandidate(null);
  },[]);

  const saveEval=async(data)=>{
    const payload={candidate_id:evalCandidate.id,evaluator_id:me.id,evaluator_name:me.name,...data};
    const {error}=await supabase.from("evaluations").upsert(payload,{onConflict:"candidate_id,evaluator_id"});
    if(!error){ showToast("Avaliação salva!"); setRankComm(evalCandidate.commission1); setEvalCandidate(null); setPage("rankings"); }
    else showToast("Erro: "+error.message);
  };
  const setFinalStatus=async(cid,status,ck)=>{
    await supabase.from("final_status").upsert({candidate_id:cid,status,commission_evaluated:ck,set_by:me.id,set_by_name:me.name},{onConflict:"candidate_id"});
    showToast("Status atualizado!");
  };
  const discard=async(cid)=>{
    await supabase.from("final_status").upsert({candidate_id:cid,status:"descartado",set_by:me.id,set_by_name:me.name},{onConflict:"candidate_id"});
    showToast("Candidato descartado.");
  };
  const remanejar=async(cid,newComm)=>{
    const cd=candidates.find(c=>c.id===cid); if(!cd) return;
    await supabase.from("candidates").update({commission1:newComm,remanejado_de:cd.remanejado_de||cd.commission1}).eq("id",cid);
    showToast(`Remanejado para ${COMMS[newComm]?.name}!`);
  };
  const resetEval=async(cid)=>{
    await supabase.from("evaluations").delete().eq("candidate_id",cid);
    await supabase.from("final_status").delete().eq("candidate_id",cid);
    showToast("Notas zeradas.");
  };
  const importCSV=async(txt)=>{
    const parsed=parseCSV(txt);
    if(!parsed.length){ showToast("Nenhum candidato encontrado."); return; }
    const {error}=await supabase.from("candidates").insert(parsed);
    if(!error) showToast(`${parsed.length} candidatos importados!`);
    else showToast("Erro: "+error.message);
  };
  const addCandidate=async(data)=>{
    const {error}=await supabase.from("candidates").insert(data);
    if(!error){ showToast("Candidato cadastrado!"); setAddingCandidate(false); setPage("candidates"); }
    else showToast("Erro: "+error.message);
  };
  const addUser=async(data)=>{
    const {error}=await supabase.from("users").insert(data);
    if(!error){ showToast("Avaliador cadastrado!"); await loadAll(); }
    else showToast("Erro: "+error.message);
  };
  const delUser=async(id)=>{ await supabase.from("users").delete().eq("id",id); await loadAll(); };

  if(!me) return <LoginScreen onLogin={setMe}/>;
  if(loading) return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      background:T.surface2,fontSize:14,color:T.ink3}}>
      Carregando...
    </div>
  );

  const renderPage=()=>{
    if(evalCandidate) return(
      <EvaluateForm candidate={evalCandidate}
        myEval={evaluations.find(e=>e.candidate_id===evalCandidate.id&&e.evaluator_id===me.id)}
        me={me} allEvals={evaluations.filter(e=>e.candidate_id===evalCandidate.id)}
        onSave={saveEval} onBack={()=>{ setEvalCandidate(null); setPage("candidates"); }}/>
    );
    if(addingCandidate) return <CandidateForm onSave={addCandidate} onBack={()=>setAddingCandidate(false)}/>;
    switch(page){
      case "candidates": return(
        <CandidatesList candidates={candidates} evaluations={evaluations}
          finalStatuses={finalStatuses} me={me}
          onAdd={()=>setAddingCandidate(true)}
          onEval={c=>{ setEvalCandidate(c); }}
          onImport={importCSV} onDiscard={discard}
          onRemanejar={remanejar} onResetEval={resetEval}
          dashFilter={dashFilter} onClearFilter={()=>setDashFilter(null)}/>
      );
      case "rankings": return(
        <Rankings candidates={candidates} evaluations={evaluations}
          finalStatuses={finalStatuses} me={me}
          onSetFinal={setFinalStatus} initComm={rankComm}/>
      );
      case "users": return(
        <Users users={users} me={me} onAdd={addUser} onDel={delUser}/>
      );
      case "export": return(
        <Export candidates={candidates} evaluations={evaluations} finalStatuses={finalStatuses}/>
      );
      default: return(
        <Dashboard candidates={candidates} evaluations={evaluations}
          finalStatuses={finalStatuses}
          onFilterNav={f=>{ setDashFilter(f); setPage("candidates"); }}/>
      );
    }
  };

  return(
    <Layout me={me} page={page} onNav={nav} onLogout={()=>{ setMe(null); localStorage.removeItem("seju_user"); setPage("dashboard"); }}>
      {renderPage()}
      <Toast msg={toast}/>
    </Layout>
  );
}
