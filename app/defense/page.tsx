import type { Metadata } from "next";
import DefenseGame from "./DefenseGame";

export const metadata: Metadata = { title: "장기전 | 디펜스 모드" };
export default function DefensePage() { return <DefenseGame />; }
