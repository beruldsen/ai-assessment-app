insert into simulation_scenarios (name, role, context)
values (
  'Exec Discovery: CFO Skeptical',
  'CFO',
  '{
    "industry":"SaaS",
    "deal_stage":"early",
    "challenge":"CFO is skeptical and wants ROI clarity",
    "goal":"Assess value framing + questioning"
  }'::jsonb
)
returning id;
