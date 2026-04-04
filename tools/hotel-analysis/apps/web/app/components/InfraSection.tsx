import React from 'react';

interface InfraSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

/**
 * Standard section wrapper for all infrastructure questionnaire sections.
 * Enforces consistent spacing, typography, and layout across all tabs.
 *
 * Usage:
 *   <InfraSection title="Impact Curve Analysis" description="...">
 *     <CurveQuestions />
 *   </InfraSection>
 */
export const InfraSection: React.FC<InfraSectionProps> = ({
  title,
  description,
  children,
  className,
  icon,
}) => {
  return (
    <section className={`infra-section ${className || ''}`}>
      <div className="infra-section-header">
        {icon && <span className="infra-section-icon">{icon}</span>}
        <h2 className="infra-section-title">{title}</h2>
      </div>

      {description && <p className="infra-section-description">{description}</p>}

      <div className="infra-section-content">{children}</div>
    </section>
  );
};

export default InfraSection;
