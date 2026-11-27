"use client";
import { Children, isValidElement, useEffect, useId, useState, type ReactNode } from "react";

export function SectionNavigation({items,value,onChange}:{items:{id:string;label:string}[];value:string;onChange:(value:string)=>void}){
  return <nav aria-label="Bagian rekaman" className="valida-section-nav sticky top-0 z-20 -mx-1 flex gap-1 overflow-x-auto border-b border-border bg-white px-1">
    {items.map(item=><button key={item.id} type="button" aria-current={value===item.id?"page":undefined}
      onClick={()=>onChange(item.id)} className={"shrink-0 border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors "+(value===item.id?"border-primary text-primary-hover":"border-transparent text-muted-foreground hover:bg-slate-50 hover:text-brand-navy")}>{item.label}</button>)}
  </nav>;
}
export function RecordSections({items,children}:{items:{id:string;label:string}[];children:ReactNode}){
  const [active,setActive]=useState(items[0]?.id||"summary");
  const id=useId();
  useEffect(()=>{
    const select=()=>{if(window.location.hash.startsWith("#qc-") && items.some(i=>i.id==="qc"))setActive("qc");};
    select();window.addEventListener("hashchange",select);return()=>window.removeEventListener("hashchange",select);
  },[items]);
  return <div className="valida-record-sections">
    <SectionNavigation items={items} value={active} onChange={setActive}/>
    <div className="valida-section-body">
      {Children.map(children,child=>{
        if(!isValidElement<{"data-record-section"?:string}>(child))return child;
        const section=child.props["data-record-section"];
        return section?<div id={id+section} hidden={active!==section}>{child}</div>:child;
      })}
    </div>
  </div>;
}
