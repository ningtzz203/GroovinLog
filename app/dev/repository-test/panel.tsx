"use client";

import { useState } from "react";
import { DataBackendPreference, getDataRepository } from "../../lib/data-repository";

type RepositoryTestResult = {
  requested: DataBackendPreference;
  selected: string;
  authenticated: boolean;
  cloudEligible: boolean;
  fallbackReason: string | null;
  migrationStatus: string | null;
  sourceFingerprint: string | null;
  counts: {
    classReviews: number;
    practiceTasks: number;
    standaloneTasks: number;
    practiceLogs: number;
    weeklyReflections: number;
    preferences: "loaded";
    reconstructedClassTasks: number;
  };
};

export default function RepositoryTestPanel() {
  const [backend, setBackend] = useState<DataBackendPreference>("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RepositoryTestResult | null>(null);

  async function runRepositoryTest() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const repository = await getDataRepository({ backend });
      const [classReviews, practiceTasks, standaloneTasks, practiceLogs, weeklyReflections] = await Promise.all([
        repository.readClassReviews(),
        repository.readPracticeTasks(),
        repository.readStandaloneTasks(),
        repository.readPracticeLogs(),
        repository.readWeeklyReflections(),
        repository.readPreferences(),
      ]);
      setResult({
        requested:repository.resolution.requested,
        selected:repository.resolution.selected,
        authenticated:repository.resolution.cloud.authenticated,
        cloudEligible:repository.resolution.cloud.eligible,
        fallbackReason:repository.resolution.fallbackReason,
        migrationStatus:repository.resolution.cloud.migration?.status ?? null,
        sourceFingerprint:repository.resolution.cloud.migration?.source_fingerprint ?? null,
        counts:{
          classReviews:classReviews.length,
          practiceTasks:practiceTasks.length,
          standaloneTasks:standaloneTasks.length,
          practiceLogs:practiceLogs.length,
          weeklyReflections:weeklyReflections.length,
          preferences:"loaded",
          reconstructedClassTasks:classReviews.reduce((total, review) => total + review.tasks.length, 0),
        },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Repository test failed.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="page">
    <header className="page-header">
      <div>
        <p className="eyebrow">Development only</p>
        <h1>Repository Test</h1>
      </div>
    </header>

    <section className="form-panel">
      <p className="settings-help">This safely reads GroovinLog data through the unified repository. It does not write to Supabase or localStorage, and it does not change the product data source.</p>
      <label>
        Backend preference
        <select value={backend} onChange={event => setBackend(event.target.value as DataBackendPreference)}>
          <option value="auto">Auto: cloud if authenticated + migrated, otherwise local</option>
          <option value="cloud">Cloud if eligible, otherwise local</option>
          <option value="local">Local only</option>
        </select>
      </label>
      <button className="primary-button enabled" type="button" disabled={loading} onClick={runRepositoryTest}>{loading ? "Reading…" : "Run Repository Read Test"}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>

    {result && <section className="form-panel">
      <h2>Summary</h2>
      <dl>
        <dt>Requested Backend</dt>
        <dd>{result.requested}</dd>
        <dt>Selected Backend</dt>
        <dd>{result.selected}</dd>
        <dt>Authenticated</dt>
        <dd>{result.authenticated ? "true" : "false"}</dd>
        <dt>Cloud Eligible</dt>
        <dd>{result.cloudEligible ? "true" : "false"}</dd>
        <dt>Fallback Reason</dt>
        <dd>{result.fallbackReason ?? "none"}</dd>
        <dt>Migration Status</dt>
        <dd>{result.migrationStatus ?? "none"}</dd>
        <dt>Source Fingerprint</dt>
        <dd>{result.sourceFingerprint ?? "none"}</dd>
        <dt>Class Reviews</dt>
        <dd>{result.counts.classReviews}</dd>
        <dt>Practice Tasks</dt>
        <dd>{result.counts.practiceTasks}</dd>
        <dt>Standalone Tasks</dt>
        <dd>{result.counts.standaloneTasks}</dd>
        <dt>Practice Logs</dt>
        <dd>{result.counts.practiceLogs}</dd>
        <dt>Weekly Reflections</dt>
        <dd>{result.counts.weeklyReflections}</dd>
        <dt>Preferences</dt>
        <dd>{result.counts.preferences}</dd>
        <dt>ClassReview.tasks total</dt>
        <dd>{result.counts.reconstructedClassTasks}</dd>
      </dl>
    </section>}
  </main>;
}
