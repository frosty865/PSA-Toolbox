'use client';

import React from 'react';
import type { Assessment } from 'schema';

export interface AssetInformationSectionProps {
  asset: Assessment['asset'];
  onUpdate: (patch: Partial<Assessment['asset']>) => void;
}

/** Asset Information tab: asset name, visit date, location (Lat/Long), PSA contact. */
export function AssetInformationSection({ asset, onUpdate }: AssetInformationSectionProps) {
  return (
    <section className="card">
      <h3 className="card-title">Asset Information</h3>
      <p className="text-secondary mb-3">
        Basic information about the asset and assessment visit.
      </p>
      <div className="form-section">
        <div className="form-group">
          <label className="form-label" htmlFor="asset-name">Asset name</label>
          <input
            id="asset-name"
            type="text"
            className="form-control"
            value={asset.asset_name}
            onChange={(e) => onUpdate({ asset_name: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="visit-date">Visit date</label>
          <input
            id="visit-date"
            type="date"
            className="form-control"
            value={asset.visit_date_iso.slice(0, 10)}
            onChange={(e) => onUpdate({ visit_date_iso: e.target.value ? `${e.target.value}T00:00:00.000Z` : asset.visit_date_iso })}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="asset-location">Location (Lat/Long, optional)</label>
          <input
            id="asset-location"
            type="text"
            className="form-control"
            value={asset.location ?? ''}
            onChange={(e) => onUpdate({ location: e.target.value || undefined })}
            placeholder="e.g. 38.9072, -77.0369"
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="services-provided">Services this facility provides</label>
          <p className="text-secondary small mb-1">One per line. Shown in the report designation block.</p>
          <textarea
            id="services-provided"
            className="form-control"
            rows={3}
            value={(asset.services_provided ?? []).join('\n')}
            onChange={(e) => {
              const list = e.target.value
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter(Boolean);
              onUpdate({ services_provided: list.length ? list : undefined });
            }}
            placeholder="e.g. Water, Wastewater (one per line)"
          />
        </div>
        <h4 className="form-label mt-4 mb-2">Protective Security Advisor (PSA) Contact</h4>
        <p className="text-secondary small mb-2">Optional. Used in the report cover; can also be set on the disclaimer screen.</p>
        <div className="form-group">
          <label className="form-label" htmlFor="psa-name">PSA name</label>
          <input
            id="psa-name"
            type="text"
            className="form-control"
            value={asset.psa_name ?? ''}
            onChange={(e) => onUpdate({ psa_name: e.target.value || undefined })}
            placeholder="PSA name"
          />
        </div>
        <div className="form-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: '1 1 80px' }}>
            <label className="form-label" htmlFor="psa-region">Region</label>
            <input
              id="psa-region"
              type="text"
              className="form-control"
              value={asset.psa_region ?? ''}
              onChange={(e) => onUpdate({ psa_region: e.target.value || undefined })}
              placeholder="e.g. 03"
            />
          </div>
          <div className="form-group" style={{ flex: '2 1 140px' }}>
            <label className="form-label" htmlFor="psa-city">City</label>
            <input
              id="psa-city"
              type="text"
              className="form-control"
              value={asset.psa_city ?? ''}
              onChange={(e) => onUpdate({ psa_city: e.target.value || undefined })}
              placeholder="City"
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="psa-cell">Cell</label>
          <input
            id="psa-cell"
            type="text"
            className="form-control"
            value={asset.psa_cell ?? ''}
            onChange={(e) => onUpdate({ psa_cell: e.target.value || undefined })}
            placeholder="Phone number"
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="psa-email">Email</label>
          <input
            id="psa-email"
            type="email"
            className="form-control"
            value={asset.psa_email ?? ''}
            onChange={(e) => onUpdate({ psa_email: e.target.value || undefined })}
            placeholder="Email address"
          />
        </div>
      </div>
    </section>
  );
}
