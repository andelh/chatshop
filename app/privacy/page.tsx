import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

const lastUpdated = "March 10, 2026";

export const metadata: Metadata = {
  title: "Privacy Policy | Clerkit",
  description:
    "Privacy Policy for Clerkit, a product operated by Techxture Media Ltd.",
};

const sections = [
  {
    title: "Who this policy covers",
    paragraphs: [
      "This Privacy Policy explains how Techxture Media Ltd collects, uses, stores, and shares information when you access or use Clerkit, including our website, app, messaging workflows, integrations, and support channels.",
      "Clerkit is designed to help merchants manage customer conversations and commerce-related activity. If you use Clerkit on behalf of a business, you confirm that you are authorized to provide information to us and to instruct us on how that information should be processed.",
    ],
  },
  {
    title: "Information we collect",
    paragraphs: [
      "We collect information you provide directly, information created through your use of Clerkit, and information we receive from connected platforms and service providers.",
    ],
    bullets: [
      "Account and business details, such as your name, email address, company name, billing information, and account preferences.",
      "Store and integration data, such as Shopify catalog details, order references, inventory signals, channel identifiers, and other data made available through approved integrations.",
      "Conversation and support data, such as customer messages, uploaded files, prompts, feedback, and support requests.",
      "Usage and technical data, such as log information, device and browser details, IP address, referring pages, feature usage, and performance diagnostics.",
    ],
  },
  {
    title: "How we use information",
    paragraphs: [
      "We use personal and business information to operate Clerkit, secure the service, improve product performance, communicate with you, and meet legal or contractual obligations.",
    ],
    bullets: [
      "Provide, maintain, and improve Clerkit and its connected workflows.",
      "Respond to support requests and communicate service, billing, or account updates.",
      "Monitor reliability, prevent abuse, investigate incidents, and protect the rights and safety of Techxture Media Ltd, our users, and the public.",
      "Comply with applicable law, enforce our agreements, and maintain business records.",
    ],
  },
  {
    title: "How customer data is handled",
    paragraphs: [
      "When you connect Clerkit to commerce or messaging platforms, we may process customer data on your behalf so the product can answer questions, surface order details, and support customer service workflows.",
      "In those situations, you remain responsible for making sure you have an appropriate legal basis to collect and share that data with Clerkit, and for providing any notices required by law to your own customers.",
    ],
  },
  {
    title: "How we share information",
    paragraphs: [
      "We do not sell personal information. We may share information with service providers and partners that help us operate Clerkit, including hosting, analytics, payment, communication, infrastructure, and integration providers.",
      "We may also disclose information when reasonably necessary to comply with law, respond to lawful requests, protect our rights, investigate misuse, or as part of a merger, acquisition, financing, or other business transaction.",
    ],
  },
  {
    title: "Data retention",
    paragraphs: [
      "We keep information for as long as reasonably necessary to provide Clerkit, meet legal and contractual obligations, resolve disputes, enforce our agreements, and maintain security and backup records.",
      "Retention periods can vary depending on the type of data, the nature of the integration, your account settings, and operational or legal requirements.",
    ],
  },
  {
    title: "Security",
    paragraphs: [
      "We use administrative, technical, and organizational measures intended to protect information against unauthorized access, loss, misuse, or alteration. No system is completely secure, and we cannot guarantee absolute security.",
      "You are responsible for maintaining the confidentiality of your account credentials and for securing the systems you use to access Clerkit.",
    ],
  },
  {
    title: "Your choices and rights",
    paragraphs: [
      "Depending on where you are located, you may have rights to request access to, correction of, deletion of, restriction of, or portability of your personal information, or to object to certain processing.",
      "To make a privacy request, use the support or contact channel made available for Clerkit. We may need to verify your identity and authority before fulfilling a request.",
    ],
  },
  {
    title: "International data transfers",
    paragraphs: [
      "Clerkit may use infrastructure and service providers located in different countries. By using the service, you understand that your information may be transferred to and processed in jurisdictions other than your own, subject to appropriate safeguards where required.",
    ],
  },
  {
    title: "Changes to this policy",
    paragraphs: [
      "We may update this Privacy Policy from time to time to reflect product, legal, operational, or security changes. When we do, we will update the effective date shown on this page and may provide additional notice when required.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      alternateHref="/terms"
      alternateLabel="Read the Terms of Service"
      eyebrow="Privacy Policy"
      lastUpdated={lastUpdated}
      sections={sections}
      summary="This policy explains what information Clerkit collects, why we use it, how Techxture Media Ltd handles connected commerce and messaging data, and the choices available to account holders."
      title="Privacy for Clerkit"
    />
  );
}
