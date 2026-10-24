"use client";
import { useRouter } from "next/navigation";
import styles from "./news-edition.module.css";
export function EditionSelect({editions,current}:{editions:{date:string;label:string}[];current:string}){
 const router=useRouter();
 return <label className={styles.editionSelect}>Previous editions<select aria-label="Choose news edition" value={current} onChange={event=>router.push(`/subnet-news/${event.target.value}`)}>{editions.map((edition,index)=><option key={edition.date} value={edition.date}>{edition.label}{index===0?" · Latest":""}</option>)}</select></label>;
}
