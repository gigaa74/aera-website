/* Decorative, dependency-free globe. No network requests or account data. */
(() => {
  'use strict';
  const host = document.querySelector('.hero-graphic');
  if (!host) {
    const observer = new MutationObserver(() => {
      const target = document.querySelector('.hero-graphic');
      if (target) { observer.disconnect(); mount(target); }
    });
    observer.observe(document.querySelector('main'), {childList:true, subtree:true});
  } else mount(host);
  function mount(host) {
    const canvas = document.createElement('canvas');
    host.append(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Stylised geographic outlines in longitude/latitude coordinates.
    const land = [
      [[-168,70],[-140,70],[-125,57],[-124,42],[-115,30],[-100,20],[-84,9],[-78,10],[-86,22],[-81,25],[-80,33],[-65,45],[-53,52],[-62,61],[-85,72],[-110,73]],
      [[-81,12],[-70,10],[-60,5],[-50,0],[-35,-7],[-40,-23],[-53,-35],[-68,-55],[-74,-47],[-70,-30],[-80,-7]],
      [[-52,60],[-42,61],[-20,76],[-28,83],[-50,82],[-62,72]],
      [[-17,36],[9,37],[32,31],[35,15],[51,11],[43,-11],[34,-25],[18,-35],[10,-20],[2,4],[-15,12]],
      [[-10,36],[-10,44],[0,49],[8,55],[5,62],[24,71],[45,67],[70,73],[110,75],[145,65],[179,65],[165,51],[140,45],[130,30],[120,22],[108,5],[99,9],[91,23],[80,8],[70,23],[52,27],[43,12],[35,31],[28,41],[15,42]],
      [[112,-11],[133,-12],[143,-10],[154,-26],[145,-39],[128,-35],[114,-25]],
      [[47,-13],[51,-16],[48,-26],[44,-24]], [[130,33],[141,44],[145,43],[139,34]],
      [[96,5],[106,-6],[119,-9],[130,-5],[117,1],[109,7]], [[166,-34],[178,-39],[170,-47],[165,-45]]
    ];
    function inside(x,y,p) { let hit=false; for(let i=0,j=p.length-1;i<p.length;j=i++) { const [a,b]=p[i], [c,d]=p[j]; if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit; }return hit; }
    const dots=[];
    for(let lat=-56;lat<=80;lat+=1.65)for(let lon=-180;lon<180;lon+=1.65/Math.cos(lat*Math.PI/180))if(land.some(p=>inside(lon,lat,p)))dots.push([lon,lat]);
    const reduce=matchMedia('(prefers-reduced-motion: reduce)');
    let frame=0, angle=-.45, last=0, visible=true, elapsed=0;
    const rad=Math.PI/180, R=150, C=220;
    function vector(lon,lat) { return [Math.cos(lat*rad)*Math.sin(lon*rad),-Math.sin(lat*rad),Math.cos(lat*rad)*Math.cos(lon*rad)]; }
    function projectVector(v,height=1) {
      const x=v[0]*Math.cos(angle)+v[2]*Math.sin(angle), z=-v[0]*Math.sin(angle)+v[2]*Math.cos(angle);
      const y=v[1]*.97+z*.243, depth=z*.97-v[1]*.243;
      return [C+R*height*(x*.978-y*.208),C+R*height*(x*.208+y*.978),depth,height];
    }
    const project=(lon,lat)=>projectVector(vector(lon,lat));
    const dotVectors=dots.map(([lon,lat])=>vector(lon,lat));
    const cities=[[2,49],[-74,41],[55,25],[104,1],[140,36],[-122,38],[-46,-24],[151,-34],[18,-34],[77,29]];
    const connections=[[0,1],[0,2],[0,8],[1,5],[1,6],[2,3],[2,9],[3,4],[3,7],[4,5]];
    const routes=connections.map(([a,b],index)=>{
      const start=vector(...cities[a]),end=vector(...cities[b]);
      const omega=Math.acos(Math.max(-1,Math.min(1,start.reduce((s,v,i)=>s+v*end[i],0))));
      return {index,points:Array.from({length:65},(_,i)=>{
        const t=i/64,sa=Math.sin((1-t)*omega)/Math.sin(omega),sb=Math.sin(t*omega)/Math.sin(omega);
        return {v:start.map((v,j)=>v*sa+end[j]*sb),h:1+Math.sin(t*Math.PI)*(.12+omega*.07)};
      })};
    });
    const grid=[];
    for(let lat=-60;lat<=60;lat+=30)grid.push(Array.from({length:121},(_,i)=>[-180+i*3,lat]));
    for(let lon=-180;lon<180;lon+=30)grid.push(Array.from({length:61},(_,i)=>[lon,-90+i*3]));
    function line(points,color,width=0.6) {
      ctx.beginPath();let started=false;
      for(const [lon,lat] of points){const [x,y,z]=project(lon,lat);if(z<0){started=false;continue;}if(started)ctx.lineTo(x,y);else ctx.moveTo(x,y);started=true;}
      ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
    }
    function draw(time=0) {
      frame=0;
      if(last&&!reduce.matches){const delta=Math.min(time-last,50);angle+=delta*.000055;elapsed+=delta*.001;}
      last=time;
      const size=host.clientWidth, ratio=Math.min(devicePixelRatio||1,2);
      if(canvas.width!==Math.round(size*ratio)){canvas.width=canvas.height=Math.round(size*ratio);}
      ctx.setTransform(canvas.width/440,0,0,canvas.height/440,0,0);ctx.clearRect(0,0,440,440);
      const glow=ctx.createRadialGradient(C,C,100,C,C,215);
      glow.addColorStop(0,'#12496133');glow.addColorStop(.58,'#1c95d038');glow.addColorStop(.82,'#33338c13');glow.addColorStop(1,'#080b1000');ctx.fillStyle=glow;ctx.fillRect(0,0,440,440);
      // Sparse ambient particles, deterministic across frames.
      for(let i=0;i<46;i++){const t=i*2.39996,r=175+(i*17%40),x=C+Math.cos(t)*r,y=C+Math.sin(t)*r;ctx.fillStyle=`rgba(120,205,255,${.13+.16*(1+Math.sin(elapsed*.6+i))/2})`;ctx.fillRect(x,y,i%6===0?1.8:.8,i%6===0?1.8:.8);}
      // Instrument ring, broken segments and fine ticks.
      ctx.save();ctx.translate(C,C);ctx.rotate(elapsed*.025);
      for(let i=0;i<96;i++){const a=i*Math.PI/48;ctx.beginPath();ctx.moveTo(Math.cos(a)*199,Math.sin(a)*199);ctx.lineTo(Math.cos(a)*(i%8===0?204:201),Math.sin(a)*(i%8===0?204:201));ctx.strokeStyle=i%8===0?'#75dbf76b':'#75dbf71e';ctx.lineWidth=.7;ctx.stroke();}
      for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(0,0,190,i*2.094,i*2.094+.8);ctx.strokeStyle=i===1?'#9987ff88':'#4ed8ff55';ctx.lineWidth=1.2;ctx.stroke();}ctx.restore();
      orbit(false);
      // Opaque shaded core correctly conceals the rear orbital segments.
      const core=ctx.createRadialGradient(170,158,8,245,240,185);
      core.addColorStop(0,'#13394b');core.addColorStop(.48,'#092330');core.addColorStop(1,'#050c17');
      ctx.beginPath();ctx.arc(C,C,R,0,Math.PI*2);ctx.fillStyle=core;ctx.fill();
      grid.forEach(points=>line(points,'#58bddd20',.55));
      // Fine coastline outlines beneath a dense field of luminous points.
      land.forEach(p=>line([...p,p[0]],'#52c6e735',.55));
      for(let i=0;i<dotVectors.length;i++){
        const [x,y,z]=projectVector(dotVectors[i]);if(z<0)continue;
        const shimmer=.84+.16*Math.sin(elapsed*1.3+i*.27),alpha=(.23+.68*Math.pow(z,.6))*shimmer;
        ctx.fillStyle=`rgba(${Math.round(65+z*75)},${Math.round(183+z*58)},255,${alpha})`;
        ctx.beginPath();ctx.arc(x,y,.45+.55*z,0,Math.PI*2);ctx.fill();
      }
      // Atmospheric scattering: brighter cyan rim, soft violet lower edge.
      const rim=ctx.createLinearGradient(100,80,330,365);rim.addColorStop(0,'#96efffcc');rim.addColorStop(.5,'#36bcf055');rim.addColorStop(1,'#9373ff99');
      ctx.beginPath();ctx.arc(C,C,R+.5,0,Math.PI*2);ctx.strokeStyle=rim;ctx.lineWidth=1.3;ctx.shadowColor='#48cfff';ctx.shadowBlur=13;ctx.stroke();ctx.shadowBlur=0;
      routes.forEach(route=>{
        const pts=route.points.map(p=>projectVector(p.v,p.h));
        const isVisible=p=>p[2]>=0||Math.hypot(p[0]-C,p[1]-C)>R+1;
        ctx.beginPath();let pen=false;
        pts.forEach(p=>{if(!isVisible(p)){pen=false;return;}if(pen)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);pen=true;});
        ctx.strokeStyle=route.index%3===0?'#a291ff65':'#5ddfff60';ctx.lineWidth=.8;ctx.stroke();
        const phase=(elapsed*.17+route.index*.137)%1;
        for(let j=0;j<9;j++){const n=Math.floor((phase-j*.009)*64);if(n<0)continue;const p=pts[n];if(!isVisible(p))continue;ctx.beginPath();ctx.arc(p[0],p[1],j===0?1.9:1.15,0,Math.PI*2);ctx.fillStyle=`rgba(${route.index%3===0?'191,172,255':'156,241,255'},${(1-j/9)*.95})`;ctx.shadowColor='#68dcff';ctx.shadowBlur=j===0?9:0;ctx.fill();}ctx.shadowBlur=0;
      });
      cities.forEach((city,i)=>{const [x,y,z]=project(...city);if(z<.05)return;
        const pulse=(elapsed*.5+i*.19)%1;ctx.beginPath();ctx.arc(x,y,3+pulse*9,0,Math.PI*2);ctx.strokeStyle=`rgba(100,220,255,${(1-pulse)*.5*z})`;ctx.lineWidth=.8;ctx.stroke();
        ctx.beginPath();ctx.arc(x,y,2.1,0,Math.PI*2);ctx.fillStyle='#dbfbff';ctx.shadowColor='#4ed8ff';ctx.shadowBlur=10;ctx.fill();ctx.shadowBlur=0;
      });
      orbit(true);
      if(visible&&!document.hidden&&!reduce.matches)frame=requestAnimationFrame(draw);
    }
    function orbit(front){
      for(let k=0;k<2;k++){
        const a=k===0?-.47:.9,rx=k===0?208:182,ry=k===0?61:78;
        ctx.save();ctx.translate(C,C);ctx.rotate(a);ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,front?0:Math.PI,front?Math.PI:Math.PI*2);ctx.strokeStyle=k===0?'#9c85ff66':'#4ed8ff25';ctx.lineWidth=k===0?.85:.6;ctx.stroke();
        const t=(elapsed*(k===0?.23:-.16)+k*2+Math.PI*4)%(Math.PI*2);
        if((Math.sin(t)>=0)===front){ctx.beginPath();ctx.arc(rx*Math.cos(t),ry*Math.sin(t),2.3,0,Math.PI*2);ctx.fillStyle=k===0?'#e0d8ff':'#bcf7ff';ctx.shadowColor=k===0?'#9d7aff':'#4ed8ff';ctx.shadowBlur=14;ctx.fill();}ctx.restore();
      }
    }
    function resume(){cancelAnimationFrame(frame);last=0;if(visible&&!document.hidden)draw();}
    new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;resume();}).observe(host);
    new ResizeObserver(resume).observe(host);
    document.addEventListener('visibilitychange',resume);reduce.addEventListener('change',resume);
    draw();
  }
})();
