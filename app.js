const $=s=>document.querySelector(s),FT=.3048,KT=.514444,R=Math.PI/180;
const W=[[-85,-180],[85,180]];
const map=L.map('map',{zoomControl:false,attributionControl:false,maxBounds:W,maxBoundsViscosity:1,zoomSnap:.25}).setView([30,10],2);
map.setMinZoom(map.getBoundsZoom(W,true));
const T={d:L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:18,noWrap:true}),s:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:18,noWrap:true})};
T.d.addTo(map);let sat=false;
const ov=L.layerGroup().addTo(map),cv=$('#ac');
let list=[],vis=[],sel=null,route=null,F={air:1,gnd:1,heli:1},Q='',backoff=0,lastG=0,busy=0,sess=[],trk=null;
const j=async(u,o)=>{const r=await fetch(u,o);if(!r.ok)throw r;return r.json()};
const st=t=>$('#st').textContent=t;
const HELI=/^(R22|R44|R66|EC\d+|AS\d+|B06|B407|B412|S76|S92|A109|A139|H60|AW\d+)$/;
const nA=x=>({id:x.hex,cs:(x.flight||'').trim(),lat:x.lat,lon:x.lon,gnd:x.alt_baro==='ground',alt:typeof x.alt_baro==='number'?x.alt_baro*FT:null,gs:(x.gs||0)*KT,trk:x.track||0,vr:(x.baro_rate||0)*FT/60,t:Date.now()/1e3-(x.seen_pos||0),heli:x.category==='A7'||HELI.test(x.t||''),type:x.t,reg:x.r,desc:x.desc,op:x.ownOp,sq:x.squawk});
const nO=s=>({id:s[0],cs:(s[1]||'').trim(),country:s[2],t:s[3]||s[4],lon:s[5],lat:s[6],alt:s[7]??s[13],gnd:s[8],gs:s[9]||0,trk:s[10]||0,vr:s[11]||0,sq:s[14],heli:s[17]===8});
const show=a=>(a.heli?F.heli:a.gnd?F.gnd:F.air)&&(!Q||[a.cs,a.reg,a.id].some(v=>v&&v.toLowerCase().includes(Q)));
function pos(a,n){if(a.gnd||!a.gs)return[a.lat,a.lon];const d=a.gs*Math.min(n-a.t,120),r=a.trk*R,la=a.lat+d*Math.cos(r)/111320;return[la,a.lon+d*Math.sin(r)/(111320*Math.cos(la*R))]}
function draw(){const s=map.getSize(),r=devicePixelRatio||1,n=Date.now()/1e3,z=map.getZoom(),sz=z<4?4.5:z<7?7:11;cv.width=s.x*r;cv.height=s.y*r;cv.style.width=s.x+'px';cv.style.height=s.y+'px';const c=cv.getContext('2d');c.scale(r,r);vis=[];
for(const a of list){if(!show(a))continue;const p=map.latLngToContainerPoint(pos(a,n));if(p.x<-20||p.y<-20||p.x>s.x+20||p.y>s.y+20)continue;a._p=p;vis.push(a);const on=sel&&sel.id===a.id;
c.save();c.translate(p.x,p.y);c.fillStyle=on?'#fff':a.heli?'#ff7b00':a.gnd?'#8d99ae':`hsl(${Math.max(0,Math.min(1,(a.alt||0)/12000))*170+30},95%,58%)`;c.strokeStyle='#000a';c.lineWidth=.8;
if(a.heli){c.beginPath();c.arc(0,0,sz*.5,0,7);c.fill();c.stroke();c.lineWidth=1.6;c.strokeStyle=c.fillStyle;c.beginPath();c.moveTo(-sz,0);c.lineTo(sz,0);c.moveTo(0,-sz);c.lineTo(0,sz);c.stroke()}
else{c.rotate(a.trk*R);c.scale(sz,sz);c.lineWidth=.08;c.beginPath();[[0,-1],[.2,-.3],[1,.2],[1,.4],[.2,.2],[.15,.8],[.45,1],[.45,1.1],[0,1],[-.45,1.1],[-.45,1],[-.15,.8],[-.2,.2],[-1,.4],[-1,.2],[-.2,-.3]].forEach((q,i)=>i?c.lineTo(...q):c.moveTo(...q));c.closePath();c.fill();c.stroke()}
c.restore()}
st(`${vis.length.toLocaleString()} aircraft in view · ${list.length.toLocaleString()} tracked${mode?` · ${mode}`:''}`)}
let mode='';
async function refresh(){if(busy||document.hidden)return;busy=1;try{
const b=map.getBounds(),S=Math.max(-85,b.getSouth()),N=Math.min(85,b.getNorth()),Wd=Math.max(-180,b.getWest()),E=Math.min(180,b.getEast()),h=(N-S)*60,w=(E-Wd)*60*Math.cos(map.getCenter().lat*R),nx=Math.ceil(w/340),ny=Math.ceil(h/340);
if(nx*ny<=6){const rq=[];for(let i=0;i<nx;i++)for(let k=0;k<ny;k++){const la=S+(k+.5)*(N-S)/ny,lo=Wd+(i+.5)*(E-Wd)/nx,rad=Math.min(250,Math.ceil(Math.hypot(w/nx,h/ny)/2)+5);
rq.push(j(`https://api.adsb.lol/v2/point/${la.toFixed(3)}/${lo.toFixed(3)}/${rad}`).catch(()=>j(`https://api.airplanes.live/v2/point/${la.toFixed(3)}/${lo.toFixed(3)}/${rad}`)).then(d=>d.ac||[]).catch(()=>null))}
const res=await Promise.all(rq),m=new Map();let ok=0;res.forEach(a=>{if(a){ok++;a.forEach(x=>x.lat!=null&&m.set(x.hex,nA(x)))}});
if(ok){list=[...m.values()];mode='live detail'}else throw 0}
else{if(Date.now()-lastG<45e3&&list.length||Date.now()<backoff){return}lastG=Date.now();
try{const d=await j('https://opensky-network.org/api/states/all?extended=1');list=(d.states||[]).filter(s=>s[6]!=null).map(nO);mode='global'}
catch(e){backoff=Date.now()+((e.headers&&+e.headers.get('x-rate-limit-retry-after-seconds'))||300)*1e3;mode='global feed busy – zoom in for live data'}}
}catch(e){mode='feed unavailable'}
if(sel){const n=list.find(a=>a.id===sel.id);if(n){Object.assign(sel,n);sess.push([sel.lat,sel.lon])}}
busy=0;draw();if(sel)panel()}
function dk(a,b){const x=Math.sin((b[0]-a[0])*R/2)**2+Math.cos(a[0]*R)*Math.cos(b[0]*R)*Math.sin((b[1]-a[1])*R/2)**2;return 12742*Math.asin(Math.sqrt(x))}
function gc(a,b){const v=p=>[Math.cos(p[0]*R)*Math.cos(p[1]*R),Math.cos(p[0]*R)*Math.sin(p[1]*R),Math.sin(p[0]*R)],A=v(a),B=v(b),w=Math.acos(Math.min(1,A[0]*B[0]+A[1]*B[1]+A[2]*B[2]))||1e-9,o=[];for(let i=0;i<=48;i++){const f=i/48,k=[Math.sin((1-f)*w)/Math.sin(w),Math.sin(f*w)/Math.sin(w)],x=A.map((_,m)=>k[0]*A[m]+k[1]*B[m]);o.push([Math.atan2(x[2],Math.hypot(x[0],x[1]))/R,Math.atan2(x[1],x[0])/R])}return o}
async function pick(a){sel=a;route=null;trk=null;sess=[[a.lat,a.lon]];ov.clearLayers();$('#sheet').classList.add('o');panel();draw();
j(`https://api.adsb.lol/v2/hex/${a.id}`).then(d=>{const x=d.ac&&d.ac[0];if(x&&sel===a){a.reg=x.r;a.type=x.t;a.desc=x.desc;a.op=x.ownOp;panel()}}).catch(()=>{});
if(a.cs)j('https://api.adsb.lol/api/0/routeset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planes:[{callsign:a.cs,lat:a.lat,lng:a.lon}]})}).then(d=>{const r=Array.isArray(d)?d[0]:d,ap=r&&r._airports;if(sel===a&&ap&&ap.length>1){route={o:ap[0],d:ap[ap.length-1]};panel()}}).catch(()=>{});
j(`https://opensky-network.org/api/tracks/all?icao24=${a.id}&time=0`).then(d=>{if(sel===a&&d.path)trk=d.path.map(p=>[p[1],p[2]]);panel()}).catch(()=>{})}
function panel(){const a=sel;if(!a)return;ov.clearLayers();const me=[a.lat,a.lon];let pr=0,eta='';
if(route){const o=[route.o.lat,route.o.lon],d=[route.d.lat,route.d.lon];L.polyline(gc(me,d),{color:'#ffb703',weight:2,dashArray:'6 6'}).addTo(ov);L.polyline(trk&&trk.length>1?[...trk,me]:gc(o,me),{color:'#4cc9f0',weight:3}).addTo(ov);[o,d].forEach(p=>L.circleMarker(p,{radius:5,color:'#fff',fillColor:'#ffb703',fillOpacity:1,weight:2}).addTo(ov));
const a1=dk(o,me),a2=dk(me,d);pr=Math.round(100*a1/(a1+a2));if(a.gs>20)eta=`${Math.round(a2*1e3/a.gs/60)} min to go · ${Math.round(a2).toLocaleString()} km`}
else L.polyline(trk&&trk.length>1?[...trk,me]:sess,{color:'#4cc9f0',weight:3}).addTo(ov);
const f=(v,u,k)=>v==null?'—':Math.round(v*k).toLocaleString()+u,ap=(p,l)=>p?`<div><big>${p.iata||p.icao}</big><small>${p.location||p.name||''}<br>${l}</small></div>`:'';
$('#sheet').innerHTML=`<div class="h"><b>${a.cs||a.id.toUpperCase()}</b><span class="x" onclick="closeS()">×</span></div><div class="sub">${[a.op,a.desc||a.type,a.heli?'Helicopter':''].filter(Boolean).join(' · ')||'Aircraft'}</div>
${route?`<div class="rt">${ap(route.o,'Departed')}<span>✈</span>${ap(route.d,'Arriving')}</div><div class="bar"><i style="width:${pr}%"></i></div><div class="sub">${pr}% flown ${eta?'· '+eta:''}</div>`:'<div class="sub">Route: not available for this flight</div>'}
<div class="g"><div><small>Altitude</small><span>${a.gnd?'On ground':f(a.alt,' ft',3.281)+' ('+f(a.alt,' m',1)+')'}</span></div><div><small>Speed</small><span>${f(a.gs,' kt',1.944)} (${f(a.gs,' km/h',3.6)})</span></div><div><small>Heading</small><span>${Math.round(a.trk)}°</span></div><div><small>Vertical rate</small><span>${f(a.vr,' ft/min',196.85)}</span></div><div><small>Flight</small><span>${a.cs||'—'}</span></div><div><small>Registration</small><span>${a.reg||'—'}</span></div><div><small>Type</small><span>${a.type||'—'}</span></div><div><small>Squawk / ICAO</small><span>${a.sq||'—'} / ${a.id.toUpperCase()}</span></div></div>`}
window.closeS=()=>{sel=null;ov.clearLayers();$('#sheet').classList.remove('o');draw()};
map.on('click',e=>{let b=null,m=26;for(const a of vis){const d=Math.hypot(a._p.x-e.containerPoint.x,a._p.y-e.containerPoint.y);if(d<m){m=d;b=a}}b?pick(b):closeS()});
map.on('move zoom',draw);let tm;map.on('moveend',()=>{clearTimeout(tm);tm=setTimeout(refresh,400)});
document.querySelectorAll('[data-f]').forEach(e=>e.onclick=()=>{F[e.dataset.f]^=1;e.classList.toggle('on');draw()});
$('#sat').onclick=e=>{sat=!sat;map.removeLayer(sat?T.d:T.s);(sat?T.s:T.d).addTo(map);e.target.classList.toggle('on',sat)};
$('#q').oninput=e=>{Q=e.target.value.trim().toLowerCase();draw()};
setInterval(refresh,10000);setInterval(draw,1000);refresh();
