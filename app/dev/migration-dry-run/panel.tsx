"use client";

import { useState } from "react";
import { dryRunMigration, MigrationDryRunResult, readMigrationSourceFromLocalStorage } from "../../lib/supabase/migration";
import { MigrationWriteResult, runAuthenticatedLocalStorageMigration } from "../../lib/supabase/migration-writer";
import { createClient } from "../../lib/supabase/client";

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return <section className="form-panel">
    <h2>{title}</h2>
    <pre>{JSON.stringify(value, null, 2)}</pre>
  </section>;
}

export default function MigrationDryRunPanel() {
  const [result, setResult] = useState<MigrationDryRunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showMigrationConfirm, setShowMigrationConfirm] = useState(false);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationError, setMigrationError] = useState("");
  const [migrationResult, setMigrationResult] = useState<MigrationWriteResult | null>(null);

  async function runDryRun() {
    setLoading(true);
    setError("");
    try {
      const source = readMigrationSourceFromLocalStorage();
      const dryRunResult = await dryRunMigration(source);
      setResult(dryRunResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Dry run failed.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function confirmMigration() {
    setMigrationLoading(true);
    setMigrationError("");
    setMigrationResult(null);
    try {
      const supabase = await createClient();
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError || !data.user) {
        setMigrationError("Please sign in before migrating.");
        return;
      }
      const writeResult = await runAuthenticatedLocalStorageMigration();
      setMigrationResult(writeResult);
      if (writeResult.status === "not-authenticated") setMigrationError("Please sign in before migrating.");
    } catch (caught) {
      setMigrationError(caught instanceof Error ? caught.message : "Migration failed.");
    } finally {
      setMigrationLoading(false);
    }
  }

  const safeMigrationSummary = migrationResult ? {
    status:migrationResult.status === "failed" && migrationResult.dryRun && !migrationResult.dryRun.canMigrate ? "validation-failed" : migrationResult.status,
    sourceFingerprint:migrationResult.sourceFingerprint ?? null,
    importedCounts:migrationResult.importedCounts ?? null,
    progress:migrationResult.progress,
    verification:migrationResult.verification ?? null,
    error:migrationResult.error ?? null,
  } : null;

  return <main className="page">
    <header className="page-header">
      <div>
        <p className="eyebrow">Development only</p>
        <h1>Migration Dry Run</h1>
      </div>
    </header>

    <section className="form-panel">
      <p className="settings-help">This reads GroovinLog localStorage and validates migration readiness. It does not write to Supabase or localStorage.</p>
      <button className="primary-button enabled" type="button" disabled={loading} onClick={runDryRun}>{loading ? "Running…" : "Run Dry Run"}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>

    {result && <>
      <section className="form-panel">
        <h2>Summary</h2>
        <dl>
          <dt>canMigrate</dt>
          <dd>{result.canMigrate ? "true" : "false"}</dd>
          <dt>sourceFingerprint</dt>
          <dd>{result.sourceFingerprint}</dd>
        </dl>
      </section>
      <JsonBlock title="counts" value={result.counts} />
      <JsonBlock title="errors" value={result.errors} />
      <JsonBlock title="warnings" value={result.warnings} />
      <JsonBlock title="relationshipIssues" value={result.relationshipIssues} />
      <JsonBlock title="duplicateIds" value={result.duplicateIds} />
      <JsonBlock title="invalidIds" value={result.invalidIds} />
    </>}

    <section className="form-panel">
      <h2>Real Migration</h2>
      <p className="settings-help">Development only. This copies the current browser&apos;s GroovinLog localStorage data into the signed-in Supabase account. It does not delete localStorage and does not switch the product data source.</p>
      {!showMigrationConfirm ? <button className="secondary-button" type="button" disabled={migrationLoading} onClick={() => {
        setShowMigrationConfirm(true);
        setMigrationError("");
        setMigrationResult(null);
      }}>Run Real Migration</button> : <div className="form-panel">
        <h3>Confirm Migration</h3>
        <p className="settings-help">This will copy the current browser&apos;s GroovinLog localStorage data to your Supabase account. localStorage will not be deleted.</p>
        <div className="ai-draft-actions">
          <button className="primary-button enabled" type="button" disabled={migrationLoading} onClick={confirmMigration}>{migrationLoading ? "Migrating…" : "Confirm Migration"}</button>
          <button className="secondary-button" type="button" disabled={migrationLoading} onClick={() => setShowMigrationConfirm(false)}>Cancel</button>
        </div>
      </div>}
      {migrationError && <p className="form-error" role="alert">{migrationError}</p>}
    </section>

    {safeMigrationSummary && <JsonBlock title="migrationResult" value={safeMigrationSummary} />}
  </main>;
}
