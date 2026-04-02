export default function AdminPage() {
  return (
    <section aria-labelledby="admin-heading" className="section active">
      <div className="section-header">
        <h1 id="admin-heading" className="section-title">Administration</h1>
      </div>
      
      <div className="card">
        <p>
          Administration provides read-only governance and oversight of the PSA system.
        </p>
        
        <p>
          This area exists to answer:
        </p>
        <ul>
          <li>What exists</li>
          <li>What is missing</li>
          <li>What is failing</li>
          <li>What has changed</li>
        </ul>
        
        <p>
          Administration does NOT:
        </p>
        <ul>
          <li>Modify doctrine</li>
          <li>Edit baseline questions</li>
          <li>Change taxonomy</li>
          <li>Trigger pipelines</li>
          <li>Run validations</li>
          <li>Generate content</li>
          <li>Execute fixes</li>
        </ul>
        
        <p>
          Administration supports human decision-making only.
          All changes occur outside this interface through controlled engineering workflows.
        </p>
        
        <h2>Future Visibility (Read-Only)</h2>
        <ul>
          <li>System status summary</li>
          <li>Taxonomy load status</li>
          <li>Baseline availability and version</li>
          <li>Depth model coverage by subtype</li>
          <li>Validation pass/fail indicators</li>
          <li>Last update timestamps</li>
          <li>Recommendations pending review (read-only)</li>
        </ul>
      </div>
    </section>
  );
}

