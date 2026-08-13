import React from "react";
import { StudyHub } from "@/components/hub/StudyHub";
import { Footer } from "@/components/layout/Footer";
import { SeoHead } from "@/components/SeoHead";

const SUBJECTS_JSONLD = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "CBSE Subjects & Chapters",
  description:
    "Browse all CBSE subjects and chapters for Class 8–12. Pick a topic and get focused, exam-ready study help.",
  url: "https://studyfilter.online/subjects",
  isPartOf: {
    "@type": "WebSite",
    name: "StudyFilter",
    url: "https://studyfilter.online/",
  },
  hasPart: [
    {
      "@type": "ItemList",
      name: "CBSE Subjects",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Mathematics" },
        { "@type": "ListItem", position: 2, name: "Science" },
        { "@type": "ListItem", position: 3, name: "Social Science" },
        { "@type": "ListItem", position: 4, name: "English" },
      ],
    },
  ],
};

export default function Subjects() {
  return (
    <div className="flex min-h-viewport flex-col bg-background">
      <SeoHead
        title="Subjects & Chapters | StudyFilter CBSE"
        description="Browse CBSE subjects and chapters for Class 8–12. Maths, Science, Social Science, English — pick a topic and get focused, exam-ready study help."
        canonical="/subjects"
        jsonLd={SUBJECTS_JSONLD}
      />
      {/*
        The sr-only <h1> that used to sit here is gone: StudyHub renders the
        page's real, visible <h1> through PageHeader now, so this page was
        shipping two level-one headings — one of them invisible and worded
        differently from the one on screen.
      */}
      <div className="flex-1">
        <StudyHub />
      </div>
      <Footer />
    </div>
  );
}
