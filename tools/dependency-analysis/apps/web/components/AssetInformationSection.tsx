'use client';

import React, { useState } from 'react';
import type { Assessment } from 'schema';
import { IDA_TAXONOMY, getIdaSubsectors } from '@/lib/ida-taxonomy';

export interface AssetInformationSectionProps {
  asset: Assessment['asset'];
  onUpdate: (patch: Partial<Assessment['asset']>) => void;
}

function parseCoords(text: string): { lat: string; lon: string } | null {
  const parts = text
    .split(/[,\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat: lat.toFixed(6), lon: lon.toFixed(6) };
}

async function geocodeAddress(address: string): Promise<{ lat: string; lon: string }> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Geocoding failed (${res.status})`);
  }
  const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
  const first = data[0];
  if (!first?.lat || !first?.lon) {
    throw new Error('No coordinates found for that address');
  }
  return { lat: first.lat, lon: first.lon };
}

/** Asset Information tab: sector, subsector, address, coordinates, PSA contact. */
export function AssetInformationSection({ asset, onUpdate }: AssetInformationSectionProps) {
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  const physicalAddress = asset.physical_address ?? asset.location ?? '';
  const mailingAddressLine1 = asset.mailing_address_line1 ?? '';
  const mailingAddressLine2 = asset.mailing_address_line2 ?? '';
  const mailingCity = asset.mailing_city ?? '';
  const mailingState = asset.mailing_state ?? '';
  const mailingZip = asset.mailing_zip ?? '';
  const mailingCountry = asset.mailing_country ?? '';
  const composedMailingAddress = [
    mailingAddressLine1,
    mailingAddressLine2,
    [mailingCity, mailingState, mailingZip].filter(Boolean).join(', '),
    mailingCountry,
  ]
    .filter(Boolean)
    .join('\n')
    .trim();
  const latValue = asset.facility_latitude ?? '';
  const lonValue = asset.facility_longitude ?? '';
  const subsectorOptions = getIdaSubsectors(asset.sector ?? '');

  const handleAutoFill = async () => {
    const coordsFromField = parseCoords(physicalAddress);
    if (coordsFromField) {
      onUpdate({
        facility_latitude: coordsFromField.lat,
        facility_longitude: coordsFromField.lon,
        location: `${coordsFromField.lat}, ${coordsFromField.lon}`,
      });
      setGeocodeError(null);
      return;
    }

    if (!physicalAddress.trim()) {
      setGeocodeError('Enter a physical address before auto-filling coordinates.');
      return;
    }

    setGeocoding(true);
    setGeocodeError(null);
    try {
      const coords = await geocodeAddress(physicalAddress);
      onUpdate({
        facility_latitude: coords.lat,
        facility_longitude: coords.lon,
        location: `${coords.lat}, ${coords.lon}`,
      });
    } catch (error) {
      setGeocodeError(error instanceof Error ? error.message : 'Failed to geocode address');
    } finally {
      setGeocoding(false);
    }
  };

    return (
    <section className="card">
      <h3 className="card-title">Facility Information</h3>
      <p className="text-secondary mb-3">
        Capture the sector, subsector, mailing address, and coordinates used in the save data and report.
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
        <div className="form-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: '1 1 180px' }}>
            <label className="form-label" htmlFor="sector">Sector</label>
            <select
              id="sector"
              className="form-control"
              value={asset.sector ?? ''}
              onChange={(e) => onUpdate({ sector: e.target.value || undefined, subsector: undefined })}
            >
              <option value="">Select a sector</option>
              {IDA_TAXONOMY.map((sector) => (
                <option key={sector.code} value={sector.name}>
                  {sector.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: '1 1 180px' }}>
            <label className="form-label" htmlFor="subsector">Subsector</label>
            <select
              id="subsector"
              className="form-control"
              value={asset.subsector ?? ''}
              onChange={(e) => onUpdate({ subsector: e.target.value || undefined })}
              disabled={!asset.sector}
            >
              <option value="">{asset.sector ? 'Select a subsector' : 'Select a sector first'}</option>
              {subsectorOptions.map((subsector) => (
                <option key={subsector.code} value={subsector.name}>
                  {subsector.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <h4 className="form-label mt-3 mb-2">Mailing Address</h4>
        <div className="form-group">
          <label className="form-label" htmlFor="mailing-address-line1">Address line 1</label>
          <input
            id="mailing-address-line1"
            type="text"
            className="form-control"
            value={mailingAddressLine1}
            onChange={(e) => {
              const next = e.target.value;
              onUpdate({
                mailing_address_line1: next || undefined,
                physical_address: [
                  next,
                  mailingAddressLine2,
                  [mailingCity, mailingState, mailingZip].filter(Boolean).join(', '),
                  mailingCountry,
                ].filter(Boolean).join('\n') || undefined,
              });
            }}
            placeholder="Street address"
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="mailing-address-line2">Address line 2</label>
          <input
            id="mailing-address-line2"
            type="text"
            className="form-control"
            value={mailingAddressLine2}
            onChange={(e) => {
              const next = e.target.value;
              onUpdate({
                mailing_address_line2: next || undefined,
                physical_address: [
                  mailingAddressLine1,
                  next,
                  [mailingCity, mailingState, mailingZip].filter(Boolean).join(', '),
                  mailingCountry,
                ].filter(Boolean).join('\n') || undefined,
              });
            }}
            placeholder="Suite, building, PO box"
          />
        </div>
        <div className="form-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: '2 1 180px' }}>
            <label className="form-label" htmlFor="mailing-city">City</label>
            <input
              id="mailing-city"
              type="text"
              className="form-control"
              value={mailingCity}
              onChange={(e) => {
                const next = e.target.value;
                onUpdate({
                  mailing_city: next || undefined,
                  physical_address: [
                    mailingAddressLine1,
                    mailingAddressLine2,
                    [next, mailingState, mailingZip].filter(Boolean).join(', '),
                    mailingCountry,
                  ].filter(Boolean).join('\n') || undefined,
                });
              }}
              placeholder="City"
            />
          </div>
          <div className="form-group" style={{ flex: '1 1 120px' }}>
            <label className="form-label" htmlFor="mailing-state">State</label>
            <input
              id="mailing-state"
              type="text"
              className="form-control"
              value={mailingState}
              onChange={(e) => {
                const next = e.target.value;
                onUpdate({
                  mailing_state: next || undefined,
                  physical_address: [
                    mailingAddressLine1,
                    mailingAddressLine2,
                    [mailingCity, next, mailingZip].filter(Boolean).join(', '),
                    mailingCountry,
                  ].filter(Boolean).join('\n') || undefined,
                });
              }}
              placeholder="State"
            />
          </div>
          <div className="form-group" style={{ flex: '1 1 120px' }}>
            <label className="form-label" htmlFor="mailing-zip">ZIP</label>
            <input
              id="mailing-zip"
              type="text"
              className="form-control"
              value={mailingZip}
              onChange={(e) => {
                const next = e.target.value;
                onUpdate({
                  mailing_zip: next || undefined,
                  physical_address: [
                    mailingAddressLine1,
                    mailingAddressLine2,
                    [mailingCity, mailingState, next].filter(Boolean).join(', '),
                    mailingCountry,
                  ].filter(Boolean).join('\n') || undefined,
                });
              }}
              placeholder="ZIP"
            />
          </div>
          <div className="form-group" style={{ flex: '1 1 160px' }}>
            <label className="form-label" htmlFor="mailing-country">Country</label>
            <input
              id="mailing-country"
              type="text"
              className="form-control"
              value={mailingCountry}
              onChange={(e) => {
                const next = e.target.value;
                onUpdate({
                  mailing_country: next || undefined,
                  physical_address: [
                    mailingAddressLine1,
                    mailingAddressLine2,
                    [mailingCity, mailingState, mailingZip].filter(Boolean).join(', '),
                    next,
                  ].filter(Boolean).join('\n') || undefined,
                });
              }}
              placeholder="United States"
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="physical-address">Physical Address</label>
          <textarea
            id="physical-address"
            className="form-control"
            rows={3}
            value={composedMailingAddress || physicalAddress}
            onChange={(e) => {
              const next = e.target.value;
              onUpdate({
                physical_address: next || undefined,
                location: next || undefined,
              });
            }}
            placeholder="Address lines, city, state, ZIP, country"
          />
        </div>
        <div className="form-group">
          <div className="form-row" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}>
            <div className="form-group" style={{ flex: '1 1 160px' }}>
              <label className="form-label" htmlFor="facility-latitude">Latitude</label>
              <input
                id="facility-latitude"
                type="text"
                className="form-control"
                value={latValue}
                onChange={(e) => onUpdate({ facility_latitude: e.target.value || undefined })}
                placeholder="Auto-populated"
              />
            </div>
            <div className="form-group" style={{ flex: '1 1 160px' }}>
              <label className="form-label" htmlFor="facility-longitude">Longitude</label>
              <input
                id="facility-longitude"
                type="text"
                className="form-control"
                value={lonValue}
                onChange={(e) => onUpdate({ facility_longitude: e.target.value || undefined })}
                placeholder="Auto-populated"
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleAutoFill}
              disabled={geocoding}
            >
              {geocoding ? 'Retrieving…' : 'Auto-fill lat/long'}
            </button>
          </div>
          {geocodeError && <p className="text-danger small mt-2 mb-0">{geocodeError}</p>}
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
