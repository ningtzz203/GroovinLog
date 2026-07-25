import { notFound } from "next/navigation";
import RepositoryTestPanel from "./panel";

export default function RepositoryTestPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <RepositoryTestPanel />;
}

