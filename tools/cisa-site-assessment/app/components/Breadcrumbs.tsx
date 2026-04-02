"use client";

import Link from "next/link";

interface BreadcrumbItem {
  label: string;
  href: string | null;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  if (!items || items.length === 0) return null;

  return (
    <nav 
      className={`breadcrumbs ${className}`}
      aria-label="Breadcrumb navigation"
      style={{
        marginBottom: "1rem",
        padding: "0.5rem 0",
      }}
    >
      <ol 
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          
          return (
            <li 
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  style={{
                    color: "#005ea2",
                    textDecoration: "none",
                    fontSize: "14px",
                  }}
                  className="breadcrumb-link"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  style={{
                    color: isLast ? "#1b1b1b" : "#565c65",
                    fontSize: "14px",
                    fontWeight: isLast ? 600 : 400,
                  }}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast && (
                <span
                  style={{
                    color: "#757575",
                    fontSize: "14px",
                  }}
                  aria-hidden="true"
                >
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
