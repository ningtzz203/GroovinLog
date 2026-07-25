import { notFound } from "next/navigation";
import CloudDataTestPanel from "./panel";

export default function CloudDataTestPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <CloudDataTestPanel />;
}
