
const STUDENTS=["윤승환","박태준","김호영","강현규","최민재","이다빈","유진아","박민지","김휘서","김보명","송민철","방송현","손희상","유지예","노진우","유진혁","정희진","태현식","정준","박연서","문경준","임홍철","조민석","이민석","조정빈","김가영","정다운"];

/*
  왼쪽 영역:
  첫 번째 줄에는 1번과 2번을 함께 배치합니다.
  마지막 줄에는 26번과 27번을 함께 표시합니다.
*/
const LEFT=[
  { seats:[1,2] },
  { seats:[6,7] },
  { seats:[11,12] },
  { seats:[16,17] },
  { seats:[21,22] },
  { seats:[26,27] }
];

const RIGHT=[
  { seats:[3,4,5] },
  { seats:[8,9,10] },
  { seats:[13,14,15] },
  { seats:[18,19,20] },
  { seats:[23,24,25] },
  { seats:[28,29,30] }
];

const ROWS=[
  ...LEFT.map(row=>row.seats),
  ...RIGHT.map(row=>row.seats)
];

const SEATS=ROWS.flat();
let seatStatuses=[];

function createSeat(number, className, assignment){
  const student=assignment?.[number];
  const element=document.createElement("div");
  element.className=`seat ${className} ${student ? "" : "empty"}`;
  element.dataset.seat=number;
  element.innerHTML=`<small>${number}번</small><span>${escapeHtml(student || "빈자리")}</span>`;
  const state=seatStatuses.find(item=>item.seat_number===number);
  if(state?.is_unavailable){
    element.classList.add("excluded-seat");
    const badge=document.createElement("small");
    badge.className="seat-fault";
    badge.textContent=`사용 불가 · ${state.reason}`;
    element.appendChild(badge);
    element.title=state.reason;
  }
  return element;
}

function createPlaceholder(){
  const element=document.createElement("div");
  element.className="seat-placeholder";
  element.setAttribute("aria-hidden","true");
  return element;
}

function rowEl(rowInfo, columns, className, assignment){
  const row=document.createElement("div");
  row.className="row";

  const seats=rowInfo.seats || rowInfo;
  const align=rowInfo.align || "left";

  if(seats.length===1 && columns===2 && align==="right"){
    row.appendChild(createPlaceholder());
    row.appendChild(createSeat(seats[0],className,assignment));
    return row;
  }

  seats.forEach(number=>{
    row.appendChild(createSeat(number,className,assignment));
  });

  while(row.children.length<columns){
    row.appendChild(createPlaceholder());
  }

  return row;
}

function renderSeats(assignment={}){
  const left=document.getElementById("leftSeats");
  const right=document.getElementById("rightSeats");

  if(!left || !right) return;

  left.innerHTML='<b class="side-title">왼쪽</b>';
  right.innerHTML='<b class="side-title">오른쪽</b>';

  LEFT.forEach(row=>left.appendChild(rowEl(row,2,"left-seat",assignment)));
  RIGHT.forEach(row=>right.appendChild(rowEl(row,3,"right-seat",assignment)));
}

function today(){
  return new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Seoul",
    year:"numeric",
    month:"2-digit",
    day:"2-digit"
  }).format(new Date());
}

function compactDate(dateText=today()){
  return dateText.replaceAll("-","");
}

function seatingPublicationDate(effectiveDate){
  const date=new Date(`${effectiveDate}T00:00:00Z`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) ||
    !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==effectiveDate) return "";
  date.setUTCDate(date.getUTCDate()-7);
  return date.toISOString().slice(0,10);
}

function kstHour(){
  return Number(new Intl.DateTimeFormat("en-US",{
    timeZone:"Asia/Seoul",
    hour:"2-digit",
    hour12:false
  }).format(new Date()));
}

function kstMinutes(){
  const value=new Date(Date.now()+9*60*60*1000);
  return value.getUTCHours()*60+value.getUTCMinutes();
}

function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
