import { css } from "lit";

export const appStyles = css`
  :host { display:block; color:#ebe7de; background:#111111; min-height:100vh; }
  main { max-width:1080px; margin:0 auto; padding:20px 18px 40px; }
  .panel { background:#171717; border:1px solid #292929; border-radius:14px; padding:16px; margin:0 0 14px; box-shadow:none; }
  .shell-header { display:flex; justify-content:space-between; gap:18px; align-items:flex-start; padding:14px 16px; background:#141414; }
  .shell-header h1 { margin:0 0 4px; font-size:24px; line-height:1.1; }
  .shell-nav { display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end; }
  .shell-hero { display:flex; justify-content:space-between; gap:18px; align-items:flex-start; padding:18px; background:#151515; }
  .grid { display:grid; gap:16px; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); }
  .simple-stat-grid { display:grid; gap:12px; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); margin:0 0 16px; }
  .simple-list { display:grid; gap:8px; }
  .simple-row { display:flex; justify-content:space-between; gap:12px; align-items:center; padding:11px 12px; border:1px solid #2c2c2c; border-radius:10px; background:#121212; transition:border-color 120ms ease, background 120ms ease; }
  .simple-row:hover { text-decoration:none; border-color:#4a4a4a; background:#1a1a1a; }
  .simple-row-main { display:grid; gap:2px; min-width:0; }
  .simple-row-main strong, .simple-row-main span { overflow-wrap:anywhere; }
  .simple-row-meta { display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end; }
  .queue-summary-grid { display:grid; gap:12px; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); margin:0 0 16px; }
  .queue-card-list { display:grid; gap:14px; }
  .queue-card { border:1px solid #2a2a2a; border-radius:14px; padding:16px; background:#141414; }
  .queue-card.runtime { border-left:4px solid #3a3a3a; }
  .queue-card.architecture { border-left:4px solid #3a3a3a; }
  .queue-card.monitor { border-left:4px solid #3a3a3a; background:#141414; }
  .queue-card-header { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin:0 0 12px; }
  .queue-card-title { margin:0; font-size:22px; line-height:1.2; }
  .queue-card-subtitle { margin:4px 0 0; font-size:12px; color:#98a0aa; word-break:break-word; }
  .queue-tag-row { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
  .queue-kv-grid { display:grid; gap:12px; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); margin:0 0 12px; }
  .queue-kv { border:1px solid #292929; border-radius:10px; padding:12px; background:#101010; min-width:0; }
  .queue-kv h4 { margin:0 0 6px; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:#8f98a4; }
  .queue-kv p { margin:0; }
  .queue-stage { font-size:14px; font-weight:700; word-break:break-word; }
  .queue-step { font-size:14px; line-height:1.5; }
  .queue-actions { display:flex; gap:10px; flex-wrap:wrap; align-items:center; padding-top:12px; border-top:1px solid #262626; }
  .queue-link-list { display:flex; gap:10px; flex-wrap:wrap; }
  .queue-highlight { border:1px solid #2a2a2a; border-radius:12px; padding:14px; background:#151515; }
  .queue-highlight h3 { margin:0 0 8px; }
  .queue-highlight p { margin:0; }
  .form-grid { display:grid; gap:12px; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); }
  .checkbox-grid { display:grid; gap:10px; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); margin:12px 0; }
  .checkbox-row { display:flex; gap:8px; align-items:center; border:1px solid #2d2d2d; border-radius:10px; background:#111111; padding:10px 12px; color:#d7d1c5; }
  .checkbox-row input { width:auto; margin:0; }
  .queue-count { font-size:28px; font-weight:700; line-height:1; margin:0 0 6px; }
  .queue-empty { text-align:center; padding:22px; border:1px dashed #343434; border-radius:12px; background:#151515; }
  .lane-case-strip { border:1px solid #2a2a2a; border-radius:14px; padding:16px; background:#141414; overflow:hidden; min-width:0; }
  .lane-case-strip.runtime { border-left:4px solid #3a3a3a; }
  .lane-case-strip.architecture { border-left:4px solid #3a3a3a; }
  .lane-case-strip h3 { margin:0 0 8px; }
  .lane-case-strip p, .lane-case-strip li { margin:0; overflow-wrap:anywhere; }
  .lane-case-strip-grid { display:grid; gap:12px; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); margin-top:14px; }
  .lane-case-strip-card { border:1px solid #292929; border-radius:12px; background:#101010; padding:12px; min-width:0; overflow:hidden; }
  .lane-case-strip.runtime .lane-case-strip-card { border-color:#292929; }
  .lane-case-strip.architecture .lane-case-strip-card { border-color:#292929; }
  .lane-case-strip-card h4 { margin:0 0 6px; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:#9a9a9a; }
  .lane-case-strip-card p, .lane-case-strip-card li { overflow-wrap:anywhere; }
  .runtime-lane-grid { display:grid; gap:14px; grid-template-columns:1.2fr 0.8fr; align-items:start; }
  .runtime-lane-stack { display:grid; gap:12px; }
  .runtime-anchor-list { display:grid; gap:10px; }
  .runtime-anchor-item { border:1px solid #292929; border-radius:12px; background:#101010; padding:12px; min-width:0; overflow:hidden; }
  .runtime-anchor-item h4 { margin:0 0 6px; font-size:15px; }
  .runtime-anchor-item p { margin:0; overflow-wrap:anywhere; }
  .lane-overview-grid { display:grid; gap:16px; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); }
  .lane-overview-card { border:1px solid #2a2a2a; border-radius:14px; background:#141414; padding:16px; min-width:0; overflow:hidden; }
  .lane-overview-card.runtime { border-left:4px solid #3a3a3a; }
  .lane-overview-card.architecture { border-left:4px solid #3a3a3a; }
  .lane-overview-card.discovery { border-left:4px solid #3a3a3a; }
  .lane-overview-card h3 { margin:0 0 8px; }
  .lane-overview-card p { margin:0; overflow-wrap:anywhere; }
  .lane-overview-stats { display:grid; gap:10px; grid-template-columns:repeat(2,minmax(0,1fr)); margin:14px 0; }
  .lane-overview-stat { border:1px solid #292929; border-radius:10px; background:#101010; padding:10px; min-width:0; overflow:hidden; }
  .lane-overview-stat h4 { margin:0 0 4px; font-size:11px; text-transform:uppercase; letter-spacing:0.04em; color:#8f98a4; }
  .lane-overview-stat p { margin:0; }
  .lane-page-grid { display:grid; gap:14px; grid-template-columns:1.15fr 0.85fr; align-items:start; }
  .lane-page-stack { display:grid; gap:12px; }
  .lane-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; }
  .lane-case-list { display:grid; gap:12px; }
  .hero { background:#151515; border:1px solid #2a2a2a; border-radius:14px; padding:18px; }
  .hero h2 { margin:0 0 8px; }
  .hero p { margin:0; }
  .hero-meta { display:flex; gap:8px; flex-wrap:wrap; margin:10px 0 0; }
  .lane-head-strip-grid { display:grid; gap:14px; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); }
  .decision-entry-list { display:grid; gap:14px; margin-top:14px; }
  .decision-entry { border:1px solid #2a2a2a; border-radius:14px; padding:16px; background:#141414; overflow:hidden; }
  .decision-entry.runtime_host_selection { border-left:4px solid #3a3a3a; }
  .decision-entry.runtime_promotion_seam_decision { border-left:4px solid #3a3a3a; }
  .decision-entry.runtime_registry_acceptance { border-left:4px solid #3a3a3a; }
  .decision-entry.architecture_materialization_due { border-left:4px solid #3a3a3a; }
  .decision-entry.discovery_routing_review { border-left:4px solid #3a3a3a; }
  .workflow-hero { display:flex; justify-content:space-between; gap:18px; align-items:flex-start; border:1px solid #2a2a2a; border-radius:18px; padding:18px; margin:0 0 16px; background:#151515; }
  .workflow-hero h2 { margin:0 0 6px; font-size:28px; }
  .workflow-hero p { margin:0; color:#98a0aa; }
  .workflow-hero-stats { display:grid; gap:8px; grid-template-columns:repeat(2,minmax(84px,1fr)); min-width:220px; }
  .workflow-hero-stats span { border:1px solid #2f2f2f; border-radius:12px; background:#101010; padding:10px; }
  .workflow-hero-stats strong { display:block; font-size:22px; line-height:1; }
  .workflow-hero-stats small { display:block; margin-top:4px; color:#98a0aa; }
  .workflow-map { display:grid; gap:14px; }
  .workflow-group { border:1px solid #2a2a2a; border-radius:16px; background:#151515; padding:14px; }
  .workflow-group-heading { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin:0 0 12px; }
  .workflow-group-heading h2 { margin:0 0 4px; }
  .workflow-group-heading p { margin:0; }
  .workflow-row-list { display:grid; gap:8px; }
  .workflow-row { border:1px solid #2b2b2b; border-radius:12px; background:#131313; overflow:hidden; }
  .workflow-row.discovery { border-left:4px solid #3a3a3a; }
  .workflow-row.architecture { border-left:4px solid #3a3a3a; }
  .workflow-row.runtime { border-left:4px solid #3a3a3a; }
  .workflow-row.host { border-left:4px solid #3a3a3a; }
  .workflow-row summary { display:flex; justify-content:space-between; gap:12px; align-items:center; padding:12px 14px; cursor:pointer; list-style:none; background:#161616; }
  .workflow-row summary::-webkit-details-marker { display:none; }
  .workflow-row summary::before { content:"+"; font-weight:700; color:#98a0aa; }
  .workflow-row[open] summary::before { content:"-"; }
  .workflow-main { display:grid; gap:3px; min-width:0; }
  .workflow-main strong, .workflow-main span { overflow-wrap:anywhere; }
  .workflow-tags { display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end; }
  .workflow-row-detail { border-top:1px solid #282828; padding:12px 14px 14px; }
  .workflow-detail-grid { display:grid; gap:10px; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); margin:0 0 10px; }
  .workflow-detail-grid div { border:1px solid #2d2d2d; border-radius:10px; background:#101010; padding:10px; min-width:0; }
  .workflow-detail-grid h4 { margin:0 0 5px; font-size:11px; text-transform:uppercase; letter-spacing:0.04em; color:#8f98a4; }
  .workflow-detail-grid p { margin:0; overflow-wrap:anywhere; }
  .seam-grid { display:grid; gap:14px; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); }
  .seam-card { border:1px solid #2c2c2c; border-radius:12px; background:#101010; padding:14px; min-width:0; }
  .seam-card h3 { margin:0 0 8px; font-size:15px; }
  .seam-card p { margin:0; }
  .seam-card ul { margin:0; }
  .seam-value { font-size:16px; font-weight:700; line-height:1.4; word-break:break-word; }
  .link-stack { display:grid; gap:8px; }
  .seam-note { border-left:4px solid #3a3a3a; padding-left:12px; }
  .nav { display:inline-block; margin:0; padding:7px 11px; border:1px solid #2f2f2f; border-radius:999px; text-decoration:none; color:#d7d1c5; background:#151515; }
  .nav:hover { text-decoration:none; border-color:#4a4a4a; background:#1c1c1c; }
  .nav.active { background:#ebebeb; color:#111111; border-color:#ebebeb; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th, td { text-align:left; padding:8px; border-bottom:1px solid #262626; vertical-align:top; }
  input, textarea, select, button { font:inherit; }
  input, textarea, select { width:100%; box-sizing:border-box; padding:8px; border:1px solid #353535; border-radius:6px; background:#111111; color:#ebe7de; }
  textarea { min-height:96px; resize:vertical; }
  button { padding:8px 12px; border-radius:6px; border:1px solid #404040; background:#e6e6e6; color:#111111; cursor:pointer; }
  button.secondary { background:#151515; color:#ebe7de; }
  .row { display:grid; gap:8px; margin:0 0 10px; }
  label, .muted { font-size:12px; color:#98a0aa; }
  .pill { display:inline-block; padding:2px 8px; border-radius:999px; border:1px solid #4a4a4a; font-size:12px; background:#181818; color:#ebe7de; }
  .actions { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  .message { background:#151515; border-color:#303030; }
  .warning { background:#151515; border-color:#303030; }
  .good { background:#151515; border-color:#303030; }
  pre { white-space:pre-wrap; word-break:break-word; background:#101010; padding:12px; border:1px solid #2a2a2a; border-radius:8px; overflow-x:auto; color:#ebe7de; }
  a { color:#d7d7d7; text-decoration:none; }
  a:hover { text-decoration:underline; }
  ul { margin:0; padding-left:18px; }
  .mono { word-break:break-all; }
  .panel, .queue-card, .queue-kv, .queue-highlight, .hero, .seam-card { overflow:hidden; }
  .queue-card-title, .queue-card-subtitle, .queue-stage, .queue-step, .seam-value, .pill { overflow-wrap:anywhere; }
  @media (max-width: 720px) {
    main { padding:14px; }
    .shell-header { flex-direction:column; }
    .shell-hero { flex-direction:column; }
    .simple-row { flex-direction:column; align-items:flex-start; }
    .simple-row-meta { justify-content:flex-start; }
    .queue-card-header { flex-direction:column; }
    .queue-tag-row { justify-content:flex-start; }
    .checkbox-row { align-items:flex-start; }
    .hero-meta { flex-direction:column; align-items:flex-start; }
    .runtime-lane-grid { grid-template-columns:1fr; }
    .lane-page-grid { grid-template-columns:1fr; }
    .workflow-hero { flex-direction:column; }
    .workflow-hero-stats { width:100%; grid-template-columns:repeat(2,minmax(0,1fr)); }
    .workflow-row summary { align-items:flex-start; }
  }
`;
