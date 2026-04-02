"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <section aria-labelledby="home-heading" className="section active">
      <div className="section-header">
        <h1 id="home-heading" className="section-title" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
          Protective Security Assessment System
        </h1>
        <p style={{ fontSize: '1.125rem', color: '#71767a', maxWidth: '800px', marginBottom: '3rem' }}>
          A comprehensive platform for conducting security assessments, analyzing document coverage, 
          and managing assessment workflows for critical infrastructure protection.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
        {/* Assessments Card */}
        <div className="card" style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: '#005ea2' }}>
              Assessments
            </h2>
            <p style={{ color: '#71767a', lineHeight: '1.6' }}>
              Create, execute, and review security assessments. Answer questions across baseline, 
              sector, and subsector layers to evaluate your organization's protective security posture.
            </p>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <Link 
              href="/assessments" 
              className="btn btn-primary"
              style={{ display: 'inline-block', textDecoration: 'none' }}
            >
              View Assessments →
            </Link>
          </div>
        </div>

        {/* Coverage Analysis Card */}
        <div className="card" style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: '#005ea2' }}>
              Coverage Analysis
            </h2>
            <p style={{ color: '#71767a', lineHeight: '1.6' }}>
              Analyze document coverage across security disciplines. View detailed coverage 
              breakdowns and evidence for ingested documents.
            </p>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <Link 
              href="/coverage" 
              className="btn btn-primary"
              style={{ display: 'inline-block', textDecoration: 'none' }}
            >
              View Coverage →
            </Link>
          </div>
        </div>

        {/* Reference Materials Card */}
        <div className="card" style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: '#005ea2' }}>
              Reference Materials
            </h2>
            <p style={{ color: '#71767a', lineHeight: '1.6' }}>
              Browse DHS Critical Infrastructure Sectors, security disciplines, and question 
              focus pages. Access authoritative taxonomy and reference documentation.
            </p>
          </div>
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Link 
              href="/sectors" 
              className="btn btn-secondary"
              style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}
            >
              Sectors
            </Link>
            <Link 
              href="/disciplines" 
              className="btn btn-secondary"
              style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}
            >
              Disciplines
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Start Section */}
      <div className="card" style={{ padding: '2rem', backgroundColor: '#f0f4f8', borderLeft: '4px solid #005ea2' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#1b1b1b' }}>
          Getting Started
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', color: '#1b1b1b' }}>
              1. Start an Assessment
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#71767a', lineHeight: '1.5' }}>
              Navigate to Assessments to view existing assessments or create a new one. 
              Each assessment evaluates your organization's security posture.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', color: '#1b1b1b' }}>
              2. Answer Questions
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#71767a', lineHeight: '1.5' }}>
              Respond to security questions across baseline, sector, and subsector layers. 
              Your responses determine your security assessment results.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', color: '#1b1b1b' }}>
              3. Review Results
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#71767a', lineHeight: '1.5' }}>
              View scored results and receive Options for Consideration (OFCs) based on 
              your responses. Use these insights to improve your security posture.
            </p>
          </div>
        </div>
      </div>

      {/* System Information */}
      <div style={{ marginTop: '3rem', padding: '1.5rem', backgroundColor: '#ffffff', border: '1px solid #d9e8f6', borderRadius: '0.25rem' }}>
        <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', color: '#1b1b1b' }}>
          System Information
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.875rem', color: '#71767a' }}>
          <div>
            <strong style={{ color: '#1b1b1b', display: 'block', marginBottom: '0.25rem' }}>Assessment System</strong>
            <p style={{ margin: 0, lineHeight: '1.5' }}>
              Execute and manage security assessments with comprehensive question sets 
              across multiple security layers.
            </p>
          </div>
          <div>
            <strong style={{ color: '#1b1b1b', display: 'block', marginBottom: '0.25rem' }}>Coverage Analysis</strong>
            <p style={{ margin: 0, lineHeight: '1.5' }}>
              Analyze document coverage across security disciplines to understand 
              evidence and gaps in your documentation.
            </p>
          </div>
          <div>
            <strong style={{ color: '#1b1b1b', display: 'block', marginBottom: '0.25rem' }}>Taxonomy Reference</strong>
            <p style={{ margin: 0, lineHeight: '1.5' }}>
              Access authoritative reference materials including DHS sectors, 
              subsectors, and security disciplines.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
