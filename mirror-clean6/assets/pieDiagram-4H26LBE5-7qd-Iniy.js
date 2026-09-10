import{ca as S,c2 as R,dK as Q,b5 as Y,b4 as tt,b6 as et,b7 as at,bp as rt,bo as nt,b8 as p,bb as W,b9 as it,bB as st,bE as ot,bI as lt,bc as ct,bv as ut,bC as pt}from"./index-B9pFv1aG.js";import{p as dt}from"./chunk-4BX2VUAB-BhQZvCBU.js";import{p as gt}from"./wardley-L42UT6IY-BzZ3gnG8.js";import{d as _}from"./arc-B7eFaDGG.js";import{o as ft}from"./ordinal-Cboi1Yqb.js";import"./init-Gi6I4Gst.js";function ht(t,a){return a<t?-1:a>t?1:a>=t?0:NaN}function mt(t){return t}function vt(){var t=mt,a=ht,f=null,y=S(0),s=S(R),d=S(0);function o(e){var n,l=(e=Q(e)).length,g,h,v=0,c=new Array(l),i=new Array(l),x=+y.apply(this,arguments),w=Math.min(R,Math.max(-R,s.apply(this,arguments)-x)),m,C=Math.min(Math.abs(w)/l,d.apply(this,arguments)),D=C*(w<0?-1:1),u;for(n=0;n<l;++n)(u=i[c[n]=n]=+t(e[n],n,e))>0&&(v+=u);for(a!=null?c.sort(function(A,b){return a(i[A],i[b])}):f!=null&&c.sort(function(A,b){return f(e[A],e[b])}),n=0,h=v?(w-l*D)/v:0;n<l;++n,x=m)g=c[n],u=i[g],m=x+(u>0?u*h:0)+D,i[g]={data:e[g],index:n,value:u,startAngle:x,endAngle:m,padAngle:C};return i}return o.value=function(e){return arguments.length?(t=typeof e=="function"?e:S(+e),o):t},o.sortValues=function(e){return arguments.length?(a=e,f=null,o):a},o.sort=function(e){return arguments.length?(f=e,a=null,o):f},o.startAngle=function(e){return arguments.length?(y=typeof e=="function"?e:S(+e),o):y},o.endAngle=function(e){return arguments.length?(s=typeof e=="function"?e:S(+e),o):s},o.padAngle=function(e){return arguments.length?(d=typeof e=="function"?e:S(+e),o):d},o}var xt=pt.pie,z={sections:new Map,showData:!1},$=z.sections,F=z.showData,St=structuredClone(xt),yt=p(()=>structuredClone(St),"getConfig"),wt=p(()=>{$=new Map,F=z.showData,ut()},"clear"),At=p(({label:t,value:a})=>{if(a<0)throw new Error(`"${t}" has invalid value: ${a}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);$.has(t)||($.set(t,a),W.debug(`added new section: ${t}, with value: ${a}`))},"addSection"),bt=p(()=>$,"getSections"),Ct=p(t=>{F=t},"setShowData"),Dt=p(()=>F,"getShowData"),V={getConfig:yt,clear:wt,setDiagramTitle:nt,getDiagramTitle:rt,setAccTitle:at,getAccTitle:et,setAccDescription:tt,getAccDescription:Y,addSection:At,getSections:bt,setShowData:Ct,getShowData:Dt},$t=p((t,a)=>{dt(t,a),a.setShowData(t.showData),t.sections.map(a.addSection)},"populateDb"),Tt={parse:p(async t=>{const a=await gt("pie",t);W.debug(a),$t(a,V)},"parse")},Et=p(t=>`
  .pieCircle{
    stroke: ${t.pieStrokeColor};
    stroke-width : ${t.pieStrokeWidth};
    opacity : ${t.pieOpacity};
  }
  .pieOuterCircle{
    stroke: ${t.pieOuterStrokeColor};
    stroke-width: ${t.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${t.pieTitleTextSize};
    fill: ${t.pieTitleTextColor};
    font-family: ${t.fontFamily};
  }
  .slice {
    font-family: ${t.fontFamily};
    fill: ${t.pieSectionTextColor};
    font-size:${t.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${t.pieLegendTextColor};
    font-family: ${t.fontFamily};
    font-size: ${t.pieLegendTextSize};
  }
`,"getStyles"),kt=Et,Mt=p(t=>{const a=[...t.values()].reduce((s,d)=>s+d,0),f=[...t.entries()].map(([s,d])=>({label:s,value:d})).filter(s=>s.value/a*100>=1);return vt().value(s=>s.value).sort(null)(f)},"createPieArcs"),Rt=p((t,a,f,y)=>{var O;W.debug(`rendering pie chart
`+t);const s=y.db,d=it(),o=st(s.getConfig(),d.pie),e=40,n=18,l=4,g=450,h=g,v=ot(a),c=v.append("g");c.attr("transform","translate("+h/2+","+g/2+")");const{themeVariables:i}=d;let[x]=lt(i.pieOuterStrokeWidth);x??(x=2);const w=o.textPosition,m=Math.min(h,g)/2-e,C=_().innerRadius(0).outerRadius(m),D=_().innerRadius(m*w).outerRadius(m*w);c.append("circle").attr("cx",0).attr("cy",0).attr("r",m+x/2).attr("class","pieOuterCircle");const u=s.getSections(),A=Mt(u),b=[i.pie1,i.pie2,i.pie3,i.pie4,i.pie5,i.pie6,i.pie7,i.pie8,i.pie9,i.pie10,i.pie11,i.pie12];let T=0;u.forEach(r=>{T+=r});const B=A.filter(r=>(r.data.value/T*100).toFixed(0)!=="0"),E=ft(b).domain([...u.keys()]);c.selectAll("mySlices").data(B).enter().append("path").attr("d",C).attr("fill",r=>E(r.data.label)).attr("class","pieCircle"),c.selectAll("mySlices").data(B).enter().append("text").text(r=>(r.data.value/T*100).toFixed(0)+"%").attr("transform",r=>"translate("+D.centroid(r)+")").style("text-anchor","middle").attr("class","slice");const U=c.append("text").text(s.getDiagramTitle()).attr("x",0).attr("y",-400/2).attr("class","pieTitleText"),G=[...u.entries()].map(([r,M])=>({label:r,value:M})),k=c.selectAll(".legend").data(G).enter().append("g").attr("class","legend").attr("transform",(r,M)=>{const P=n+l,q=P*G.length/2,H=12*n,J=M*P-q;return"translate("+H+","+J+")"});k.append("rect").attr("width",n).attr("height",n).style("fill",r=>E(r.label)).style("stroke",r=>E(r.label)),k.append("text").attr("x",n+l).attr("y",n-l).text(r=>s.getShowData()?`${r.label} [${r.value}]`:r.label);const j=Math.max(...k.selectAll("text").nodes().map(r=>(r==null?void 0:r.getBoundingClientRect().width)??0)),K=h+e+n+l+j,L=((O=U.node())==null?void 0:O.getBoundingClientRect().width)??0,X=h/2-L/2,Z=h/2+L/2,N=Math.min(0,X),I=Math.max(K,Z)-N;v.attr("viewBox",`${N} 0 ${I} ${g}`),ct(v,g,I,o.useMaxWidth)},"draw"),Wt={draw:Rt},Ot={parser:Tt,db:V,renderer:Wt,styles:kt};export{Ot as diagram};
