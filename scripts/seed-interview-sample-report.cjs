const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => !line.trim().startsWith('#'))
    .map((line) => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx), line.slice(idx + 1)];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const interviewId = process.argv[2];
if (!interviewId) {
  console.error('Usage: node scripts/seed-interview-sample-report.cjs <interviewId>');
  process.exit(1);
}

const sampleScores = [
  {
    capability: 'Business Value Discovery & Co-Creation',
    score: 4.6,
    evidence_summary: 'The participant consistently reframes technical requirements into measurable business value, links discovery to commercial outcomes, and shows strong value co-creation discipline.',
    strengths: ['Connects technical work to business outcomes early.', 'Uses discovery to reshape customer thinking at a strategic level.'],
    development_areas: [],
    behavioural_patterns: ['feature-focused vs business-focused'],
    coaching_recommendations: ['Leverage this strength in high-stakes strategic account conversations and peer coaching.'],
  },
  {
    capability: 'Customer & Internal Influence / Collaboration',
    score: 3.1,
    evidence_summary: 'The participant shows solid stakeholder coordination and influence, though the evidence suggests there is still room to strengthen conflict navigation and broader alignment under pressure.',
    strengths: ['Builds alignment across internal and customer stakeholders.'],
    development_areas: ['Use more deliberate conflict-resolution tactics when stakeholders have competing priorities.'],
    behavioural_patterns: ['passive vs ownership-driven'],
    coaching_recommendations: ['Practice stakeholder-mapping and decision sequencing in live deals to improve consistency.'],
  },
  {
    capability: 'Executive Communication, Storytelling & Presence',
    score: 2.7,
    evidence_summary: 'The participant can simplify ideas, but the overall signal is that executive messaging is not yet consistently concise, decision-oriented, or commercially anchored enough for senior audiences.',
    strengths: ['Makes an effort to adapt technical content for non-technical listeners.'],
    development_areas: ['Tighten messaging to lead with business stakes, decision trade-offs, and executive relevance.'],
    behavioural_patterns: ['detail without business impact'],
    coaching_recommendations: ['Use role-play and meeting debriefs to strengthen executive-level clarity, brevity, and presence.'],
  },
  {
    capability: 'Strategic Account Thinking',
    score: 4.1,
    evidence_summary: 'The participant demonstrates strong strategic account judgement, spotting longer-term risks and opportunities early and connecting current action to downstream value creation.',
    strengths: ['Anticipates account risk and expansion potential early.', 'Shapes account direction beyond the immediate task.'],
    development_areas: [],
    behavioural_patterns: ['reactive vs strategic'],
    coaching_recommendations: ['Use this strength more visibly in account planning and executive deal reviews.'],
  },
  {
    capability: 'AI Fluency & Human Trust Advantage',
    score: 3.0,
    evidence_summary: 'The participant uses AI with reasonable judgement, but the report suggests more explicit examples are needed to show strategic leverage, validation discipline, and business impact.',
    strengths: ['Shows awareness of trust and validation when using AI.'],
    development_areas: ['Capture and communicate clearer examples of AI improving quality, speed, or customer outcomes.'],
    behavioural_patterns: ['AI-dependent vs AI-augmented'],
    coaching_recommendations: ['Build a stronger library of real AI-assisted scenarios that demonstrate judgement and measurable value.'],
  },
  {
    capability: 'Technical Credibility & Continuous Learning',
    score: 2.4,
    evidence_summary: 'The participant shows baseline technical credibility, but there is limited evidence of proactive capability building or of translating new learning into stronger customer outcomes.',
    strengths: ['Maintains core technical competence in familiar areas.'],
    development_areas: ['Show more proactive learning, faster application, and stronger linkage between technical growth and business outcomes.'],
    behavioural_patterns: ['technical-only vs balanced'],
    coaching_recommendations: ['Set a focused learning plan tied to live opportunities and review how new knowledge changes recommendations and outcomes.'],
  },
];

(async () => {
  await supabase.from('interview_scores').delete().eq('interview_id', interviewId);
  const { error } = await supabase.from('interview_scores').insert(
    sampleScores.map((row) => ({ interview_id: interviewId, ...row }))
  );
  if (error) throw error;
  console.log(JSON.stringify({ interviewId, inserted: sampleScores.length }, null, 2));
})();
