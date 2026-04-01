# VOFC Backfill Wave 2 Queue

## Scope

This queue covers assessment questions that currently have no mapped vulnerability template and therefore no OFCs.

## Source Packs

- Electric power and restoration: FEMA continuity guidance, NFPA 110/1600, IEEE distribution reliability references.
- Communications continuity and restoration: FCC TSP, CISA communications redundancy resources, CSRIC material.
- IT continuity and hosted-service resilience: ISO 22301, NIST CSF.
- Water and wastewater continuity: EPA water/wastewater resilience and emergency response guidance.

Reference corpus location for extraction and citation linking:
- `D:\PSA_System\data\download\general\General_All_Sectors`
- `D:\PSA_System\data\library`

## Backfill Order

1. Electric power
2. Water
3. Wastewater
4. Communications
5. Information technology

## Question Queue

### Electric power

- `E-4`
- `E-5`
- `E-6`
- `E-7`
- `E-7a`
- `E-9`
- `E-10`

### Water

- `W_Q1`
- `W_Q2`
- `W_Q3`
- `W_Q4`
- `W_Q7`
- `W_Q9`
- `W_Q10`
- `W_Q11`
- `W_Q12`
- `W_Q13`
- `W_Q14`
- `W_Q15`
- `W_Q16`
- `W_Q17`
- `W_Q18`

### Wastewater

- `WW_Q1`
- `WW_Q2`
- `WW_Q3`
- `WW_Q4`
- `WW_Q7`
- `WW_Q8`
- `WW_Q9`
- `WW_Q10`
- `WW_Q11`
- `WW_Q12`
- `WW_Q13`
- `WW_Q14`

### Communications

- `COMM-0`
- `COMM-SP1`
- `COMM-SP2`
- `COMM-SP3`

### Information technology

- `IT-7`
- `IT-7a`

## Definition Of Done Per Question

- Question has at least one mapped vulnerability template.
- Each mapped vulnerability has at least 3 OFCs.
- Each vulnerability has valid citation IDs in `citations_registry.ts`.
- PRA/SLA-only vulnerabilities remain gated with `requiresPRA: true`.
- `validateQuestionVulnMap()` passes with no errors.
