import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

const lastUpdated = "March 10, 2026";

export const metadata: Metadata = {
  title: "Terms of Service | Clerkit",
  description:
    "Terms of Service for Clerkit, a product operated by Techxture Media Ltd.",
};

const sections = [
  {
    title: "Agreement to these terms",
    paragraphs: [
      "These Terms of Service govern your access to and use of Clerkit, which is owned and operated by Techxture Media Ltd. By accessing or using Clerkit, you agree to be bound by these terms. If you use Clerkit on behalf of an organization, you represent that you have authority to bind that organization to these terms.",
    ],
  },
  {
    title: "Using Clerkit",
    paragraphs: [
      "Clerkit provides tools that help businesses manage customer conversations, automate replies, and connect commerce-related workflows with approved third-party platforms.",
      "You may use Clerkit only in compliance with applicable law, platform rules, and these terms. You are responsible for your account, your team members, your connected integrations, and the content and data you submit through the service.",
    ],
  },
  {
    title: "Account responsibilities",
    paragraphs: [
      "You agree to provide accurate account information, keep your login credentials secure, and promptly update information if it changes. You are responsible for all activity that occurs under your account unless caused directly by our breach of these terms.",
      "If you believe your account has been compromised, you must notify us without undue delay.",
    ],
  },
  {
    title: "Acceptable use",
    paragraphs: [
      "You may not use Clerkit to engage in unlawful, deceptive, harmful, or abusive conduct, or in a way that interferes with the operation or security of the service.",
    ],
    bullets: [
      "Do not use Clerkit to violate privacy, intellectual property, consumer protection, or anti-spam laws.",
      "Do not upload, transmit, or generate content that is fraudulent, infringing, defamatory, hateful, or malicious.",
      "Do not attempt to probe, disrupt, reverse engineer, or bypass safeguards in Clerkit or its supporting systems, except where restricted by law from limiting that right.",
      "Do not use Clerkit in a manner that breaches the terms of connected third-party services such as commerce, social, or messaging platforms.",
    ],
  },
  {
    title: "Your content and data",
    paragraphs: [
      "You retain ownership of the content and data you submit to Clerkit. You grant Techxture Media Ltd a non-exclusive, worldwide, limited license to host, store, reproduce, modify, and process that content only as needed to operate, maintain, secure, and improve Clerkit and to comply with law.",
      "You are responsible for ensuring that you have all rights, permissions, and disclosures necessary for the content and data you use with Clerkit.",
    ],
  },
  {
    title: "Third-party services",
    paragraphs: [
      "Clerkit may interoperate with third-party services, including commerce, messaging, hosting, payment, and AI providers. Your use of those third-party services is governed by their own terms and policies.",
      "We are not responsible for third-party services, including their availability, security, accuracy, or policy changes. If a third-party provider restricts, suspends, or changes access, parts of Clerkit may be affected.",
    ],
  },
  {
    title: "Fees and changes",
    paragraphs: [
      "If Clerkit offers paid plans, you agree to pay applicable fees, taxes, and charges according to the pricing and billing terms presented to you at the time of purchase. Unless stated otherwise, fees are non-refundable except where required by law.",
      "We may change pricing, features, or packaging from time to time. When required, we will provide advance notice before materially adverse pricing changes take effect.",
    ],
  },
  {
    title: "Availability and disclaimers",
    paragraphs: [
      "We aim to keep Clerkit available and reliable, but the service is provided on an as available and as provided basis to the maximum extent permitted by law. We do not guarantee uninterrupted operation, error-free performance, or that Clerkit will meet every business requirement.",
      "Automation and AI-assisted outputs may be incomplete or incorrect. You are responsible for reviewing outputs and for any business decisions, customer communications, or operational actions taken using Clerkit.",
    ],
  },
  {
    title: "Limitation of liability",
    paragraphs: [
      "To the maximum extent permitted by law, Techxture Media Ltd and its directors, employees, affiliates, and service providers will not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for any loss of profits, revenues, goodwill, data, or business opportunities arising out of or related to Clerkit.",
      "To the maximum extent permitted by law, the total aggregate liability of Techxture Media Ltd for claims arising out of or relating to Clerkit will not exceed the amount you paid to us for the service during the twelve months preceding the event giving rise to the claim, or one hundred United States dollars if you have not paid for Clerkit.",
    ],
  },
  {
    title: "Suspension and termination",
    paragraphs: [
      "We may suspend or terminate your access to Clerkit if we reasonably believe you have violated these terms, created security or legal risk, failed to pay applicable fees, or used the service in a way that could harm Clerkit, our users, or third parties.",
      "You may stop using Clerkit at any time. Sections that by their nature should survive termination will survive, including provisions relating to ownership, disclaimers, limitations of liability, payments due, and dispute resolution.",
    ],
  },
  {
    title: "Changes to these terms",
    paragraphs: [
      "We may update these terms from time to time. If we make material changes, we may provide notice through Clerkit, by email, or by posting an updated version on this page. Your continued use of Clerkit after the effective date of updated terms constitutes acceptance of the revised terms.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      alternateHref="/privacy"
      alternateLabel="Read the Privacy Policy"
      eyebrow="Terms of Service"
      lastUpdated={lastUpdated}
      sections={sections}
      summary="These terms describe the rules for accessing Clerkit, your responsibilities as an account holder, and the operational limits that apply to the service provided by Techxture Media Ltd."
      title="Terms for using Clerkit"
    />
  );
}
