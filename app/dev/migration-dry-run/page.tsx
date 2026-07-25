import { notFound } from "next/navigation";
import MigrationDryRunPanel from "./panel";

export default function MigrationDryRunPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <MigrationDryRunPanel />;
}
