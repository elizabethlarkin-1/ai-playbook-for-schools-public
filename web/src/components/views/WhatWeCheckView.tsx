"use client";

import { fmtDate } from "@/lib/text";
import { usePlaybook } from "../PlaybookProvider";
import styles from "./WhatWeCheckView.module.css";

/** "How we check the tools": the recheck rule and where facts come from, in plain words for school staff. */
export default function WhatWeCheckView() {
  const { content } = usePlaybook();
  return (
    <article className={styles.page}>
      <h2 className={styles.title}>How we check the tools</h2>
      <p className={styles.lead}>Every fact in a tool&apos;s Scouting report comes from the company&apos;s own website. Here&apos;s how we keep it honest and up to date.</p>

      <section className={styles.card}>
        <h3>Where the facts come from</h3>
        <p>We only use the company&apos;s official pages: its pricing page, privacy page, help center and trust center. We don&apos;t use news stories, reviews or social media for facts.</p>
      </section>

      <section className={styles.card}>
        <h3>Where your data goes</h3>
        <p>Each Scouting report says where the company is based, where it stores your data, and where your data may be processed. Different countries have different privacy laws, so this can matter to you and your district.</p>
        <ul>
          <li><b>Stored</b> is where the company keeps your data over time, like the file cabinet a student&apos;s file sits in.</li>
          <li><b>Processed</b> is anywhere your data is sent to be used, like the computers that read your question and write an AI tool&apos;s answer, or a support team that helps with your account.</li>
        </ul>
        <p><b>Why both matter:</b> a company can truthfully say &ldquo;we store your data in the U.S.&rdquo; and still send your questions to other countries to be answered. For example, Claude for Teachers stores data in the U.S. but may process it in Europe, Asia or Australia. Many district agreements require both to stay in the U.S., so check both before using a tool with student information. (<button type="button" className="term" data-term="data-location">Data location</button> in Lingo &amp; Acronyms.)</p>
        <p>We show these facts for every tool, so you can decide. When a company doesn&apos;t say, we write <b>Not stated by the company</b> and list it under <b>Under review</b>.</p>
      </section>

      <section className={styles.card}>
        <h3>We check every tool at once</h3>
        <p>When we recheck, we look at <b>every</b> tool in the playbook, including any new ones. The date at the top of the page (<b>Tools last checked {fmtDate(content.checkedOn)}</b>) is the last time we did that.</p>
        <p>Prices and privacy terms can change between checks, so always confirm on the company&apos;s site before you buy or sign up.</p>
      </section>

      <section className={styles.card}>
        <h3>What the badges mean</h3>
        <ul>
          <li><b>✓ (like FERPA ✓)</b>: the company says this on its own website.</li>
          <li><b>? or Check</b>: we couldn&apos;t confirm it. The company hasn&apos;t published it.</li>
          <li><b>No public DPA</b>: we checked, and the company hasn&apos;t published a data privacy agreement. Ask your district before sharing any student information.</li>
          <li><b>Equity 3/4</b>: how many of our four equity checks the tool meets (free school-wide, any device, languages, accessibility).</li>
        </ul>
      </section>

      <section className={styles.card}>
        <h3>When we can&apos;t confirm something</h3>
        <p>Sometimes a company doesn&apos;t publish a detail, like which devices it works on. We don&apos;t guess. We mark it <b>Check</b> and list it under <b>Under review</b>, next to the date at the top of the page.</p>
        <p>Under review doesn&apos;t mean something is wrong. It means you should ask the company or your district if that detail matters to you.</p>
        <p>When we <b>can</b> confirm that a tool doesn&apos;t have something, like student accounts or a published data agreement, we say so in its Scouting report under <b>Confirmed: not offered</b>.</p>
      </section>

      <section className={styles.card}>
        <h3>How we find new tools</h3>
        <p>At each recheck we also look for tools worth adding:</p>
        <ul>
          <li><b>What teachers recommend:</b> teacher communities online (like Reddit&apos;s teacher groups) and Common Sense Education reviews.</li>
          <li><b>What schools actually use:</b> state student-privacy agreement lists and yearly reports on the most-used tools in U.S. schools.</li>
        </ul>
        <p>These help us find tools. Before a tool joins the playbook, we check all of its facts on its own website, just like the others.</p>
      </section>

      <section className={styles.card}>
        <h3>Before you use any tool</h3>
        <ul>
          <li>Check your district&apos;s AI policy.</li>
          <li>Make sure your district has a signed <button type="button" className="term" data-term="dpa">DPA</button> with the company before any student information goes in.</li>
          <li>Never put student names, IDs or other private details into an AI tool.</li>
        </ul>
      </section>
    </article>
  );
}
