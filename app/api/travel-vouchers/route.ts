import { env } from "cloudflare:workers";

let schemaReady=false;
async function ensureSchema(){
  if(schemaReady)return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS travel_vouchers (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    voucher_no text NOT NULL UNIQUE,
    enq_no text NOT NULL,
    voucher_date text NOT NULL,
    site_location text DEFAULT '' NOT NULL,
    contact text DEFAULT '' NOT NULL,
    particulars text DEFAULT 'Travelling Expenses' NOT NULL,
    travel_from text DEFAULT 'Solutions Optispace' NOT NULL,
    travel_to text DEFAULT '' NOT NULL,
    distance_km real DEFAULT 0 NOT NULL,
    km_rate real DEFAULT 20 NOT NULL,
    stay_days real DEFAULT 0 NOT NULL,
    people real DEFAULT 2 NOT NULL,
    stay_rate real DEFAULT 5000 NOT NULL,
    amount real DEFAULT 0 NOT NULL,
    amount_words text DEFAULT '' NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (enq_no) REFERENCES leads(enq_no) ON DELETE CASCADE
  )`).run();
  for(const statement of ["ALTER TABLE travel_vouchers ADD distance_km real DEFAULT 0 NOT NULL","ALTER TABLE travel_vouchers ADD km_rate real DEFAULT 20 NOT NULL","ALTER TABLE travel_vouchers ADD stay_days real DEFAULT 0 NOT NULL","ALTER TABLE travel_vouchers ADD people real DEFAULT 2 NOT NULL","ALTER TABLE travel_vouchers ADD stay_rate real DEFAULT 5000 NOT NULL"]){try{await env.DB.prepare(statement).run();}catch{}}
  schemaReady=true;
}

const map=(row:any)=>({id:Number(row.id),voucherNo:row.voucher_no,enqNo:row.enq_no,voucherDate:row.voucher_date,siteLocation:row.site_location,contact:row.contact,particulars:row.particulars,travelFrom:row.travel_from,travelTo:row.travel_to,distanceKm:Number(row.distance_km),kmRate:Number(row.km_rate),stayDays:Number(row.stay_days),people:Number(row.people),stayRate:Number(row.stay_rate),amount:Number(row.amount),amountWords:row.amount_words,createdAt:row.created_at,updatedAt:row.updated_at,companyName:row.company_name,clientName:row.client_name});

export async function GET(){
  await ensureSchema();
  const result=await env.DB.prepare(`SELECT v.*,l.company_name,l.client_name FROM travel_vouchers v INNER JOIN leads l ON l.enq_no=v.enq_no WHERE l.deleted_at IS NULL ORDER BY v.updated_at DESC,v.id DESC`).all();
  return Response.json({travelVouchers:(result.results||[]).map(map)});
}

async function values(request:Request){
  const body=await request.json() as Record<string,unknown>;
  const enqNo=String(body.enqNo||"").trim(),voucherDate=String(body.voucherDate||"").trim(),amount=Number(body.amount);
  if(!enqNo)return {error:"Please select a company / lead."};
  if(!voucherDate)return {error:"Voucher date is required."};
  if(!(amount>0))return {error:"Voucher amount must be greater than zero."};
  const lead=await env.DB.prepare("SELECT enq_no FROM leads WHERE enq_no=? AND deleted_at IS NULL").bind(enqNo).first();
  if(!lead)return {error:"Selected lead was not found."};
  return {enqNo,voucherDate,siteLocation:String(body.siteLocation||"").trim(),contact:String(body.contact||"").trim(),particulars:String(body.particulars||"Travelling Expenses").trim(),travelFrom:String(body.travelFrom||"Solutions Optispace").trim(),travelTo:String(body.travelTo||"").trim(),distanceKm:Number(body.distanceKm)||0,kmRate:Number(body.kmRate)||0,stayDays:Number(body.stayDays)||0,people:Number(body.people)||0,stayRate:Number(body.stayRate)||0,amount,amountWords:String(body.amountWords||"").trim()};
}

export async function POST(request:Request){
  await ensureSchema();const data=await values(request);if("error" in data)return Response.json({error:data.error},{status:400});
  const last=await env.DB.prepare("SELECT voucher_no FROM travel_vouchers ORDER BY id DESC LIMIT 1").first<{voucher_no:string}>();
  const suffix=Math.max(0,Number(last?.voucher_no?.match(/(\d+)$/)?.[1]||0))+1,voucherNo=`TV-2627-${String(suffix).padStart(3,"0")}`;
  const result=await env.DB.prepare(`INSERT INTO travel_vouchers (voucher_no,enq_no,voucher_date,site_location,contact,particulars,travel_from,travel_to,distance_km,km_rate,stay_days,people,stay_rate,amount,amount_words) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *`).bind(voucherNo,data.enqNo,data.voucherDate,data.siteLocation,data.contact,data.particulars,data.travelFrom,data.travelTo,data.distanceKm,data.kmRate,data.stayDays,data.people,data.stayRate,data.amount,data.amountWords).first();
  return Response.json({travelVoucher:map(result)},{status:201});
}

export async function PATCH(request:Request){
  await ensureSchema();const body=await request.clone().json() as {id?:number};const id=Number(body.id);if(!id)return Response.json({error:"Voucher id is required."},{status:400});
  const data=await values(request);if("error" in data)return Response.json({error:data.error},{status:400});
  const result=await env.DB.prepare(`UPDATE travel_vouchers SET enq_no=?,voucher_date=?,site_location=?,contact=?,particulars=?,travel_from=?,travel_to=?,distance_km=?,km_rate=?,stay_days=?,people=?,stay_rate=?,amount=?,amount_words=?,updated_at=CURRENT_TIMESTAMP WHERE id=? RETURNING *`).bind(data.enqNo,data.voucherDate,data.siteLocation,data.contact,data.particulars,data.travelFrom,data.travelTo,data.distanceKm,data.kmRate,data.stayDays,data.people,data.stayRate,data.amount,data.amountWords,id).first();
  if(!result)return Response.json({error:"Travel voucher not found."},{status:404});
  return Response.json({travelVoucher:map(result)});
}

export async function DELETE(request:Request){
  await ensureSchema();const id=Number(new URL(request.url).searchParams.get("id"));if(!id)return Response.json({error:"Voucher id is required."},{status:400});
  const result=await env.DB.prepare("DELETE FROM travel_vouchers WHERE id=? RETURNING id").bind(id).first();
  if(!result)return Response.json({error:"Travel voucher not found."},{status:404});
  return Response.json({deleted:true,id});
}
