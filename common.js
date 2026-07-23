
const STUDENTS=["윤승환","박태준","김호영","강현규","최민재","이다빈","유진아","박민지","김휘서","김보명","송민철","방송현","손희상","유지예","노진우","유진혁","정희진","태현식","정준","박연서","문경준","임홍철","조민석","이민석","조정빈","김가영","정다운"];
const LEFT=[[2],[6,7],[11,12],[16,17],[21,22],[27]],RIGHT=[[3,4,5],[8,9,10],[13,14,15],[18,19,20],[23,24,25],[28,29,30]],ROWS=[...LEFT,...RIGHT],SEATS=ROWS.flat();
function rowEl(nums,cols,cls,a){const r=document.createElement("div");r.className="row";for(let i=0;i<cols;i++){if(i<nums.length){const n=nums[i],name=a?.[n],e=document.createElement("div");e.className=`seat ${cls} ${name?"":"empty"}`;e.innerHTML=`<small>${n}번</small><span>${name||"빈자리"}</span>`;r.appendChild(e)}else{const e=document.createElement("div");e.style.visibility="hidden";r.appendChild(e)}}return r}
function renderSeats(a={}){const l=document.getElementById("leftSeats"),r=document.getElementById("rightSeats");l.innerHTML="<b>왼쪽</b>";r.innerHTML="<b>오른쪽</b>";LEFT.forEach(x=>l.appendChild(rowEl(x,2,"left-seat",a)));RIGHT.forEach(x=>r.appendChild(rowEl(x,3,"right-seat",a)))}
function today(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function kstHour(){return Number(new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Seoul",hour:"2-digit",hour12:false}).format(new Date()))}
