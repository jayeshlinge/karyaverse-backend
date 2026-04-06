-- =============================================
-- KARYAVERSE DATABASE SCHEMA
-- =============================================
-- Run this entire file in:
-- Supabase Dashboard → SQL Editor → New query → Paste → Run
-- =============================================


-- ─── EXTENSION ────────────────────────────────────────────────────────────
-- Needed for gen_random_uuid()
create extension if not exists "pgcrypto";


-- ══════════════════════════════════════════════════════════════════════════
-- TABLE: tools
-- Stores all AI tools listed on the marketplace
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists tools (
  id            uuid        default gen_random_uuid() primary key,
  name          text        not null,
  description   text,
  category      text        not null,
  url           text        not null,
  affiliate_url text,                          -- your affiliate link (earns commission)
  access_type   text        not null default 'free'
                            check (access_type in ('free','freemium','paid')),
  tags          text[]      default '{}',      -- array of tags e.g. ['chatbot','writing']
  icon          text,                          -- font-awesome class e.g. 'fas fa-robot'
  icon_color    text,                          -- hex or css var
  is_verified   boolean     default false,     -- karyaverse verified badge
  is_featured   boolean     default false,     -- appears first / sponsored
  is_active     boolean     default true,      -- soft delete
  click_count   integer     default 0,         -- affiliate click tracker
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Index for fast filtering
create index if not exists tools_category_idx   on tools (category);
create index if not exists tools_access_idx     on tools (access_type);
create index if not exists tools_featured_idx   on tools (is_featured);
create index if not exists tools_active_idx     on tools (is_active);

-- Full-text search index on name + description
create index if not exists tools_search_idx on tools
  using gin (to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,'')));


-- ══════════════════════════════════════════════════════════════════════════
-- TABLE: submissions
-- Innovation Lab project submissions from students
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists submissions (
  id            uuid        default gen_random_uuid() primary key,
  name          text        not null,
  email         text        not null,
  project       text        not null,
  category      text,
  description   text        not null,
  demo_url      text,
  school        text,
  status        text        not null default 'pending'
                            check (status in ('pending','reviewing','approved','rejected','winner')),
  admin_notes   text,                          -- internal notes for Kartiki
  ip_address    text,                          -- for spam detection
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists submissions_status_idx on submissions (status);
create index if not exists submissions_email_idx  on submissions (email);


-- ══════════════════════════════════════════════════════════════════════════
-- TABLE: prompts
-- Prompt library (both free and premium)
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists prompts (
  id            uuid        default gen_random_uuid() primary key,
  title         text        not null,
  type          text,                          -- e.g. 'Zero-Shot', 'Chain-of-Thought'
  category      text        not null,          -- zero-shot, cot, creative, study, business, code
  prompt_text   text        not null,
  is_premium    boolean     default false,     -- premium prompt pack content
  copy_count    integer     default 0,         -- how many times it was copied
  is_active     boolean     default true,
  created_at    timestamptz default now()
);

create index if not exists prompts_category_idx on prompts (category);


-- ══════════════════════════════════════════════════════════════════════════
-- TABLE: newsletter
-- Email newsletter subscribers
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists newsletter (
  id            uuid        default gen_random_uuid() primary key,
  email         text        not null unique,
  name          text,
  subscribed    boolean     default true,
  subscribed_at timestamptz default now(),
  unsubscribed_at timestamptz
);

create index if not exists newsletter_email_idx on newsletter (email);


-- ══════════════════════════════════════════════════════════════════════════
-- TABLE: contact_messages
-- General contact form submissions
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists contact_messages (
  id            uuid        default gen_random_uuid() primary key,
  name          text        not null,
  email         text        not null,
  subject       text,
  message       text        not null,
  ip_address    text,
  is_read       boolean     default false,
  created_at    timestamptz default now()
);


-- ══════════════════════════════════════════════════════════════════════════
-- FUNCTIONS: increment counters safely
-- ══════════════════════════════════════════════════════════════════════════

-- Increment tool click count
create or replace function increment_tool_clicks(tool_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update tools set click_count = click_count + 1
  where id = tool_id;
end;
$$;

-- Increment prompt copy count
create or replace function increment_prompt_copies(prompt_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update prompts set copy_count = copy_count + 1
  where id = prompt_id;
end;
$$;

-- Auto-update updated_at timestamp
create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Attach trigger to tools and submissions
create trigger tools_updated_at
  before update on tools
  for each row execute function update_updated_at();

create trigger submissions_updated_at
  before update on submissions
  for each row execute function update_updated_at();


-- ══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- Protects your data — public can only READ tools & prompts
-- Everything else requires your server's service key
-- ══════════════════════════════════════════════════════════════════════════

alter table tools             enable row level security;
alter table submissions       enable row level security;
alter table prompts           enable row level security;
alter table newsletter        enable row level security;
alter table contact_messages  enable row level security;

-- Tools: public can read active tools
create policy "Public read active tools"
  on tools for select
  using (is_active = true);

-- Prompts: public can read active prompts
create policy "Public read active prompts"
  on prompts for select
  using (is_active = true);

-- All other operations require service role key (your backend server)
-- The backend uses SUPABASE_SERVICE_KEY which bypasses RLS automatically


-- ══════════════════════════════════════════════════════════════════════════
-- SEED DATA: insert your existing tools from the marketplace
-- ══════════════════════════════════════════════════════════════════════════

insert into tools (name, description, category, url, affiliate_url, access_type, tags, icon, icon_color, is_verified, is_featured) values

-- LLMs & Chat AI
('ChatGPT',        'The world''s most popular AI chatbot by OpenAI. Writes, codes, explains, and creates.',           'LLMs & Chat AI',    'https://chat.openai.com',        null, 'freemium', '{"chatbot","writing","coding"}',       'fas fa-robot',          '#10b981', true, true),
('Claude AI',      'Anthropic''s AI assistant — thoughtful, safe, and great for long documents.',                     'LLMs & Chat AI',    'https://claude.ai',              null, 'freemium', '{"chatbot","writing","analysis"}',     'fas fa-brain',          '#6366f1', true, true),
('Gemini',         'Google''s most capable AI model. Integrated with Google Workspace.',                              'LLMs & Chat AI',    'https://gemini.google.com',      null, 'freemium', '{"chatbot","google","multimodal"}',    'fas fa-gem',            '#06b6d4', true, false),
('Perplexity AI',  'AI-powered search engine that gives sourced, real-time answers.',                                 'LLMs & Chat AI',    'https://perplexity.ai',          null, 'freemium', '{"search","research","real-time"}',    'fas fa-search',         '#f59e0b', true, false),
('Grok',           'Elon Musk''s xAI chatbot with real-time Twitter/X data access.',                                  'LLMs & Chat AI',    'https://grok.x.ai',              null, 'freemium', '{"chatbot","real-time","x"}',          'fas fa-bolt',           '#ec4899', true, false),
('Mistral AI',     'Open-source LLM with strong reasoning. Fast and privacy-focused.',                                'LLMs & Chat AI',    'https://mistral.ai',             null, 'freemium', '{"open-source","coding","reasoning"}', 'fas fa-wind',           '#8b5cf6', false, false),
('Meta Llama',     'Meta''s open-source AI model — run locally or via API.',                                          'LLMs & Chat AI',    'https://llama.meta.com',         null, 'free',     '{"open-source","local","llm"}',        'fas fa-infinity',       '#f97316', false, false),

-- Image Generation
('Midjourney',     'Most stunning AI image generator. Creates photorealistic and artistic images.',                   'Image Generation',  'https://midjourney.com',         null, 'paid',     '{"images","art","photorealistic"}',    'fas fa-image',          '#ec4899', true, true),
('DALL·E 3',       'OpenAI''s image generator built into ChatGPT. Excellent prompt understanding.',                   'Image Generation',  'https://openai.com/dall-e-3',    null, 'freemium', '{"images","openai","creative"}',       'fas fa-palette',        '#6366f1', true, false),
('Stable Diffusion','Open-source image generation. Run locally or use online tools.',                                 'Image Generation',  'https://stability.ai',           null, 'free',     '{"images","open-source","local"}',     'fas fa-layer-group',    '#10b981', false, false),
('Adobe Firefly',  'Adobe''s AI image generator. Safe for commercial use, integrated with Adobe apps.',               'Image Generation',  'https://firefly.adobe.com',      null, 'freemium', '{"images","adobe","commercial"}',      'fas fa-fire',           '#f97316', true, false),
('Canva AI',       'Design platform with built-in AI image generation, text effects, and background removal.',        'Image Generation',  'https://canva.com',              null, 'freemium', '{"design","images","templates"}',      'fas fa-pen-nib',        '#06b6d4', true, true),
('Ideogram',       'AI image generator that excels at text inside images. Great for logos and posters.',              'Image Generation',  'https://ideogram.ai',            null, 'freemium', '{"images","text","logos"}',            'fas fa-font',           '#f59e0b', false, false),

-- Video AI
('Runway ML',      'Professional AI video generation and editing. Text to video, image to video.',                    'Video AI',          'https://runwayml.com',           null, 'freemium', '{"video","generation","editing"}',     'fas fa-video',          '#f97316', true, true),
('Sora',           'OpenAI''s groundbreaking text-to-video model. Cinematic quality videos.',                         'Video AI',          'https://sora.com',               null, 'paid',     '{"video","openai","cinematic"}',       'fas fa-film',           '#6366f1', true, false),
('HeyGen',         'AI avatar videos. Create talking-head videos with AI presenters in minutes.',                     'Video AI',          'https://heygen.com',             null, 'freemium', '{"avatar","presenter","marketing"}',   'fas fa-user-tie',       '#10b981', true, false),
('CapCut',         'Popular video editor with powerful AI features. Auto-captions, effects, templates.',              'Video AI',          'https://capcut.com',             null, 'freemium', '{"editing","mobile","social"}',        'fas fa-cut',            '#ec4899', true, true),
('Pika Labs',      'AI video generation from text or images. Great for short creative clips.',                        'Video AI',          'https://pika.art',               null, 'freemium', '{"video","generation","creative"}',    'fas fa-play-circle',    '#8b5cf6', false, false),
('Invideo AI',     'Full AI-powered video creation from a prompt. Includes stock footage and voiceover.',             'Video AI',          'https://invideo.io',             null, 'freemium', '{"video","script","voiceover"}',       'fas fa-magic',          '#f59e0b', false, false),

-- Coding & Dev
('GitHub Copilot', 'AI pair programmer inside VS Code. Autocomplete, chat, and code generation.',                    'Coding & Dev',      'https://github.com/features/copilot', null, 'freemium', '{"coding","vscode","autocomplete"}', 'fas fa-code',          '#6366f1', true, true),
('Cursor',         'AI-first code editor. Full codebase understanding, chat, and inline edits.',                      'Coding & Dev',      'https://cursor.sh',              null, 'freemium', '{"editor","coding","ai-native"}',      'fas fa-terminal',       '#10b981', true, true),
('Bolt.new',       'Full-stack AI coding in the browser. Build, run, and deploy apps instantly.',                     'Coding & Dev',      'https://bolt.new',               null, 'freemium', '{"fullstack","browser","deploy"}',     'fas fa-bolt',           '#f59e0b', true, false),
('Lovable',        'Generate full-stack web apps from a description. React, Supabase, all included.',                 'Coding & Dev',      'https://lovable.dev',            null, 'freemium', '{"webapp","react","supabase"}',        'fas fa-heart',          '#ec4899', true, false),
('Replit AI',      'Online IDE with AI coding assistant. Perfect for students learning to code.',                     'Coding & Dev',      'https://replit.com',             null, 'freemium', '{"online","learning","coding"}',       'fas fa-laptop-code',    '#f97316', true, false),
('v0 by Vercel',   'Generate UI components from text. React, Tailwind, production-ready code.',                       'Coding & Dev',      'https://v0.dev',                 null, 'freemium', '{"ui","react","components"}',          'fas fa-object-group',   '#06b6d4', true, false),

-- Student Tools
('Khanmigo',       'Khan Academy''s AI tutor. Teaches every subject step-by-step, never gives answers directly.',     'Student Tools',     'https://khanacademy.org/khan-labs', null, 'freemium', '{"tutor","education","math"}',       'fas fa-graduation-cap', '#10b981', true, true),
('Gamma',          'Create beautiful presentations, docs, and websites with AI in seconds.',                          'Student Tools',     'https://gamma.app',              null, 'freemium', '{"presentations","docs","design"}',    'fas fa-presentation',   '#6366f1', true, true),
('NotebookLM',     'Google''s AI research tool. Upload PDFs and chat with your documents.',                           'Student Tools',     'https://notebooklm.google.com',  null, 'free',     '{"research","pdf","notes"}',           'fas fa-book',           '#f59e0b', true, false),
('Quizlet AI',     'AI-powered flashcards and study tools. Auto-generate quizzes from any content.',                  'Student Tools',     'https://quizlet.com',            null, 'freemium', '{"flashcards","study","quiz"}',        'fas fa-layer-group',    '#ec4899', true, false),
('Wolfram Alpha',  'Computational intelligence. Solves maths, science, and data problems step-by-step.',              'Student Tools',     'https://wolframalpha.com',       null, 'freemium', '{"math","science","computing"}',       'fas fa-calculator',     '#f97316', false, false),

-- Audio & Voice
('Suno AI',        'Create full songs with lyrics from a text prompt. Incredibly realistic music generation.',        'Audio & Voice',     'https://suno.ai',                null, 'freemium', '{"music","songs","generation"}',       'fas fa-music',          '#f59e0b', true, true),
('ElevenLabs',     'Best AI voice cloning and text-to-speech. 1000+ realistic voices in 29 languages.',              'Audio & Voice',     'https://elevenlabs.io',          null, 'freemium', '{"voice","tts","cloning"}',            'fas fa-microphone',     '#6366f1', true, true),
('Udio',           'AI music generation rival to Suno. High-quality, diverse genres.',                                'Audio & Voice',     'https://udio.com',               null, 'freemium', '{"music","generation","genres"}',      'fas fa-headphones',     '#ec4899', false, false),
('Murf AI',        'Professional AI voiceovers. 120+ voices, used for videos, podcasts, e-learning.',                'Audio & Voice',     'https://murf.ai',                null, 'freemium', '{"voiceover","podcast","elearning"}',  'fas fa-broadcast-tower','#10b981', true, false),

-- Writing & Copy
('Grammarly',      'AI writing assistant. Grammar, tone, clarity, and plagiarism checker.',                          'Writing & Copy',    'https://grammarly.com',          null, 'freemium', '{"grammar","writing","editing"}',      'fas fa-spell-check',    '#10b981', true, true),
('Jasper AI',      'AI marketing copywriter. Blog posts, ads, emails, and social media at scale.',                   'Writing & Copy',    'https://jasper.ai',              null, 'paid',     '{"copywriting","marketing","ads"}',    'fas fa-pen-fancy',      '#f97316', true, false),
('QuillBot',       'AI paraphraser and summarizer. Essential for students — rewrite and summarize text.',             'Writing & Copy',    'https://quillbot.com',           null, 'freemium', '{"paraphrase","summary","student"}',   'fas fa-quill',          '#6366f1', false, false),
('Copy.ai',        'Marketing copy generator. Landing pages, ads, email sequences from prompts.',                    'Writing & Copy',    'https://copy.ai',                null, 'freemium', '{"copywriting","marketing","emails"}', 'fas fa-copy',           '#ec4899', true, false),

-- Productivity
('Notion AI',      'AI built into Notion. Summarize notes, generate content, and automate workflows.',               'Productivity',      'https://notion.com',             null, 'freemium', '{"notes","workspace","ai"}',           'fas fa-sticky-note',    '#6366f1', true, true),
('Zapier AI',      'No-code automation platform. Connect 6000+ apps with AI-powered workflows.',                     'Productivity',      'https://zapier.com',             null, 'freemium', '{"automation","workflow","no-code"}',  'fas fa-project-diagram','#f97316', true, false),
('Make (Integromat)','Visual workflow automation. Build complex automations without code.',                           'Productivity',      'https://make.com',               null, 'freemium', '{"automation","visual","workflow"}',   'fas fa-cogs',           '#10b981', false, false),
('Taskade AI',     'AI-powered project management, mind maps, and task automation.',                                 'Productivity',      'https://taskade.com',            null, 'freemium', '{"tasks","mindmap","projects"}',       'fas fa-tasks',          '#06b6d4', false, false),

-- Design & UI
('Figma AI',       'The industry-standard design tool now with AI-powered design features.',                         'Design & UI',       'https://figma.com',              null, 'freemium', '{"design","ui","prototype"}',          'fas fa-vector-square',  '#f59e0b', true, true),
('Uizard',         'Design UIs from sketches or screenshots using AI. No design skills needed.',                     'Design & UI',       'https://uizard.io',              null, 'freemium', '{"ui","prototyping","mockup"}',        'fas fa-object-ungroup', '#ec4899', true, false),
('Looka',          'AI logo maker. Generate professional logos and brand kits in minutes.',                          'Design & UI',       'https://looka.com',              null, 'freemium', '{"logo","branding","identity"}',       'fas fa-star',           '#6366f1', false, false),
('Remove.bg',      'Remove image backgrounds instantly with AI. Free and fast.',                                     'Design & UI',       'https://remove.bg',              null, 'freemium', '{"background","images","editing"}',    'fas fa-eraser',         '#10b981', true, false);


-- ══════════════════════════════════════════════════════════════════════════
-- SEED DATA: Prompts from your prompts.html
-- ══════════════════════════════════════════════════════════════════════════

insert into prompts (title, type, category, prompt_text) values

('Explain Like I''m 10',        'Zero-Shot · Explanation',          'zero-shot', 'Explain [TOPIC] to me like I''m a 10-year-old. Use a simple analogy, avoid jargon, and end with one real-world example I can relate to.'),
('Step-by-Step Problem Solver', 'Chain-of-Thought · Problem Solving','cot',       'Solve this problem step by step. First, identify the key components. Then, reason through each step carefully. Finally, give a clear answer and explain why it is correct. Problem: [YOUR PROBLEM]'),
('Exam Question Generator',     'Study · Exam Prep',                'study',     'I am studying [SUBJECT] for [EXAM/CLASS]. Generate 10 practice questions of varying difficulty — 3 easy, 4 medium, 3 hard. For each question, also provide the answer and explain the concept tested.'),
('Story with a Twist',          'Creative · Storytelling',          'creative',  'Write a short story about [CHARACTER] who [SITUATION]. The story must have an unexpected twist in the final paragraph. Use vivid sensory details, and make the character''s internal conflict clear throughout.'),
('Business Idea Validator',     'Business · Startup',               'business',  'I have a business idea: [DESCRIBE YOUR IDEA]. Analyze it using the following framework: 1) Problem it solves, 2) Target market, 3) Top 3 competitors, 4) Revenue model, 5) Main risks. Be honest and critical.'),
('Bug Finder & Fixer',          'Coding · Debugging',               'code',      'Here is my code: [PASTE CODE]. It should [EXPECTED BEHAVIOR] but instead it [ACTUAL BEHAVIOR]. Find the bug, explain what caused it in simple terms, and provide the corrected code with comments.'),
('Deep Research Prompt',        'Chain-of-Thought · Analysis',      'cot',       'Research [TOPIC] deeply. Structure your response as: Background → Current State → Key Players → Challenges → Future Outlook → My Recommendation. Use chain-of-thought reasoning and cite why each claim is true.'),
('Feynman Technique Prompt',    'Study · Concept Mastery',          'study',     'Teach me [CONCEPT] using the Feynman Technique. Start with the simplest possible explanation, then gradually add depth. After explaining, quiz me with 3 questions to test my understanding.'),
('Midjourney Master Prompt',    'Creative · Image Prompts',         'creative',  'Create a Midjourney prompt for: [DESCRIBE IMAGE]. Include: subject, setting, lighting (golden hour/neon/dramatic), art style (hyperrealistic/anime/watercolor), camera (wide angle/macro), and mood. Output the prompt in Midjourney format.'),
('Social Media Content Plan',   'Business · Marketing',             'business',  'Create a 7-day social media content plan for [BRAND/PRODUCT] targeting [AUDIENCE]. For each day: platform, post type (reel/carousel/story), hook sentence, key message, and call-to-action. Make it viral-worthy.'),
('Smart Article Summarizer',    'Zero-Shot · Summarization',        'zero-shot', 'Summarize this article in 3 formats: 1) A 1-sentence TL;DR, 2) A 5-bullet executive summary, 3) A 3-paragraph detailed summary with key insights highlighted. Article: [PASTE ARTICLE]'),
('App Architecture Designer',   'Coding · Architecture',            'code',      'I want to build [APP IDEA]. Design the full technical architecture: frontend framework, backend stack, database choice, API design, and deployment strategy. Explain why each choice is optimal for this use case. Include a simple diagram in text format.');


-- ══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY POLICIES
-- Run this AFTER creating the tables above
-- ══════════════════════════════════════════════════════════════════════════

-- Enable RLS on submissions
alter table submissions enable row level security;

-- Anyone can INSERT a new submission (public form)
create policy "Anyone can submit"
on submissions for insert
to anon
with check (true);

-- Anyone can READ submissions (to show on public page)
create policy "Anyone can view submissions"
on submissions for select
to anon
using (true);

-- Only authenticated users (admin) can UPDATE winner status
create policy "Admin can update"
on submissions for update
to anon
using (true)
with check (true);

-- Only authenticated users (admin) can DELETE
create policy "Admin can delete"
on submissions for delete
to anon
using (true);

-- Enable RLS on tools (public read)
alter table tools enable row level security;
create policy "Anyone can read tools"
on tools for select to anon using (is_active = true);

-- Enable RLS on prompts (public read)
alter table prompts enable row level security;
create policy "Anyone can read prompts"
on prompts for select to anon using (is_active = true);

-- Enable RLS on newsletter (insert only)
alter table newsletter enable row level security;
create policy "Anyone can subscribe"
on newsletter for insert to anon with check (true);

