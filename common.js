
let STUDENTS=["윤승환","박태준","김호영","강현규","최민재","이다빈","유진아","박민지","김휘서","김보명","송민철","방송현","손희상","유지예","노진우","유진혁","정희진","태현식","정준","박연서","문경준","임홍철","조민석","이민석","조정빈","김가영","정다운"];

/*
  왼쪽 영역:
  2번과 27번은 왼쪽 책상 영역의 "우측 열"에 배치합니다.
  즉, 첫 번째 칸은 비워 두고 두 번째 칸에 좌석을 표시합니다.
*/
const LEFT=[
  { seats:[2], align:"right" },
  { seats:[6,7] },
  { seats:[11,12] },
  { seats:[16,17] },
  { seats:[21,22] },
  { seats:[27], align:"right" }
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

function createSeat(number, className, assignment){
  const student=assignment?.[number];
  const element=document.createElement("div");
  element.className=`seat ${className} ${student ? "" : "empty"}`;
  element.innerHTML=`<small>${number}번</small><span>${student || "빈자리"}</span>`;
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

function kstHour(){
  return Number(new Intl.DateTimeFormat("en-US",{
    timeZone:"Asia/Seoul",
    hour:"2-digit",
    hour12:false
  }).format(new Date()));
}

function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
