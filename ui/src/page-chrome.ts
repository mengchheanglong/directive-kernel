export function getDirectiveUiPageChrome(current: string) {
  if (current === "/") {
    return {
      eyebrow: "",
      title: "Dashboard",
      description: "",
      actions: [],
    };
  }

  if (current === "/queue") {
    return {
      eyebrow: "Discovery surface",
      title: "Sources",
      description:
        "Track the live intake queue, routing posture, downstream pointers, and current legal next steps.",
      actions: [
        { href: "/discovery", label: "Open discovery lane", tone: "primary" as const },
        { href: "/workflow-map", label: "See workflow map", tone: "secondary" as const },
      ],
    };
  }

  if (current === "/workflow-map") {
    return {
      eyebrow: "Flow visibility",
      title: "Workflow Map",
      description:
        "A compact source-to-runtime map for live routing, lane heads, and operator decision gates.",
      actions: [
        { href: "/", label: "Back to overview", tone: "secondary" as const },
        { href: "/operator-inbox", label: "Open inbox", tone: "primary" as const },
      ],
    };
  }

  if (current === "/operator-inbox") {
    return {
      eyebrow: "Operator coordination",
      title: "Decision Inbox",
      description:
        "Read-only triage over the explicit Discovery, Architecture, and Runtime decisions blocking forward motion.",
      actions: [
        { href: "/workflow-map", label: "View workflow map", tone: "secondary" as const },
        { href: "/runtime", label: "Open runtime lane", tone: "primary" as const },
      ],
    };
  }

  if (current === "/discovery") {
    return {
      eyebrow: "Lane surface",
      title: "Discovery",
      description:
        "See intake pressure, routing outcomes, and the explicit handoff boundary before deeper drill-down.",
      actions: [
        { href: "/queue", label: "Open sources", tone: "primary" as const },
        { href: "/workflow-map", label: "See flow map", tone: "secondary" as const },
      ],
    };
  }

  if (current === "/architecture") {
    return {
      eyebrow: "Lane surface",
      title: "Architecture",
      description:
        "Monitor live Architecture heads, retained outputs, and recent canonical anchors without breaking lane ownership.",
      actions: [
        { href: "/handoffs", label: "Open handoffs", tone: "secondary" as const },
        { href: "/workflow-map", label: "See flow map", tone: "primary" as const },
      ],
    };
  }

  if (current === "/runtime") {
    return {
      eyebrow: "Lane surface",
      title: "Runtime",
      description:
        "Watch active Runtime cases, current blockers, and host-facing capability progression from one place.",
      actions: [
        { href: "/engine-runs", label: "Open engine runs", tone: "secondary" as const },
        { href: "/workflow-map", label: "See flow map", tone: "primary" as const },
      ],
    };
  }

  if (current === "/engine-runs" || current.startsWith("/engine-runs/")) {
    return {
      eyebrow: "Execution trace",
      title: "Engine Runs",
      description:
        "Inspect recent routing decisions, proof planning, and downstream lane selection with direct traceability.",
      actions: [
        { href: "/", label: "Back to overview", tone: "secondary" as const },
        { href: "/workflow-map", label: "Open workflow map", tone: "primary" as const },
      ],
    };
  }

  if (current === "/handoffs" || current.startsWith("/handoffs/")) {
    return {
      eyebrow: "Downstream continuity",
      title: "Handoffs",
      description:
        "Review bounded Architecture and Runtime continuation stubs before they become lane-native records.",
      actions: [
        { href: "/architecture", label: "Open architecture lane", tone: "secondary" as const },
        { href: "/runtime", label: "Open runtime lane", tone: "primary" as const },
      ],
    };
  }

  return {
    eyebrow: "Artifact surface",
    title: "Detail View",
    description:
      "Deep artifact detail, lane-native records, and proof surfaces stay accessible without losing shell context.",
    actions: [
      { href: "/", label: "Back to overview", tone: "secondary" as const },
      { href: "/queue", label: "Open sources", tone: "primary" as const },
    ],
  };
}
