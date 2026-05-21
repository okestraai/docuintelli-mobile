export interface LegalSection {
  heading: string;
  body: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_CONTENT: FaqItem[] = [
  {
    question: 'What is DocuIntelli AI?',
    answer:
      'DocuIntelli AI is an intelligent document companion that lets you upload leases, insurance policies, warranties, and employment contracts and ask questions in plain English.',
  },
  {
    question: 'What is document amnesia and why does it cost people money?',
    answer:
      'Document amnesia refers to the disconnect between signing agreements and understanding their terms, resulting in missed warranty claims, auto-renewed leases you didn\'t want, and insurance coverage gaps you didn\'t know about.',
  },
  {
    question: 'What is the best app to understand my lease agreement?',
    answer:
      'DocuIntelli AI is purpose-built for understanding lease agreements. Upload your lease and ask questions like "Can my landlord raise rent mid-lease?"',
  },
  {
    question: 'How is DocuIntelli AI different from ChatGPT for understanding documents?',
    answer:
      'While ChatGPT lacks document memory across sessions, DocuIntelli AI provides a secure vault, automatic expiration tracking, e-signatures, cloud storage import, emergency access, and financial insights.',
  },
  {
    question: 'How is DocuIntelli AI different from Google Drive?',
    answer:
      'Google Drive stores files but doesn\'t understand them. DocuIntelli AI reads, understands, and acts on your documents.',
  },
  {
    question: 'Does DocuIntelli AI store or train on my personal documents?',
    answer:
      'Your documents are stored securely with AES-256 encryption. Your documents are never used to train AI models.',
  },
  {
    question: 'What is the pricing for DocuIntelli AI?',
    answer:
      'Three tiers: Free (3 documents), Starter ($9/month, 25 documents), and Pro ($15/month, 100 documents).',
  },
  {
    question: 'Is DocuIntelli AI available on iPhone and Android?',
    answer: 'Yes, with complete feature parity across platforms.',
  },
  {
    question: 'What does my renter\'s insurance cover?',
    answer:
      'Upload your policy to receive specific answers about coverage and exclusions.',
  },
  {
    question: 'How do I avoid a lease auto-renewal?',
    answer:
      'Upload your lease and DocuIntelli AI automatically tracks your lease expiration and notifies you before the deadline.',
  },
];

export const TERMS_CONTENT: LegalSection[] = [
  {
    heading: 'Terms & Conditions',
    body: 'Last updated: February 15, 2026',
  },
  {
    heading: '1. Acceptance of Terms',
    body: 'By accessing or using DocuIntelli AI ("the Service"), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, you may not use the Service. These terms apply to all visitors, users, and others who access or use the Service.',
  },
  {
    heading: '2. Description of Service',
    body: 'DocuIntelli AI is an AI-powered document management platform that allows users to upload, organize, and interact with personal documents including warranties, insurance policies, leases, employment contracts, and other important files. The Service includes document storage, AI-powered chat and analysis, automatic tagging, expiration tracking, and related features as described on our pricing page.',
  },
  {
    heading: '3. User Accounts',
    body: 'To use the Service, you must create an account using a valid email address or Google authentication. You are responsible for:\n\n\u2022 Maintaining the confidentiality of your account credentials\n\u2022 All activities that occur under your account\n\u2022 Notifying us immediately of any unauthorized use of your account\n\u2022 Ensuring that the information you provide is accurate and up to date',
  },
  {
    heading: '4. Subscription Plans & Billing',
    body: 'DocuIntelli AI offers three subscription tiers: Free, Starter ($9/month or $90/year), and Pro ($15/month or $150/year). Each plan includes specific limits on document storage, monthly uploads, and AI token budgets as described on the pricing page.\n\n\u2022 Upgrades take effect immediately. You will be charged a prorated amount for the remainder of your current billing cycle.\n\u2022 Downgrades take effect at the end of your current billing period. If your document count exceeds the lower plan\u2019s limit, you will be asked to select which documents to retain.\n\u2022 Cancellations take effect at the end of the current billing period. After cancellation, your account reverts to the Free plan.\n\u2022 Monthly counters (uploads and token budgets) reset automatically at the start of each month. Unused quota does not carry over.',
  },
  {
    heading: '5. Acceptable Use',
    body: 'You agree not to use the Service to:\n\n\u2022 Upload illegal, harmful, or infringing content\n\u2022 Attempt to gain unauthorized access to other users\u2019 accounts or data\n\u2022 Interfere with or disrupt the Service or its infrastructure\n\u2022 Use automated scripts, bots, or scrapers to access the Service\n\u2022 Resell, redistribute, or sublicense access to the Service\n\u2022 Upload files containing malware, viruses, or other harmful code',
  },
  {
    heading: '6. Document Storage & Ownership',
    body: 'You retain full ownership of all documents you upload to DocuIntelli AI. We do not claim any intellectual property rights over your content. Documents are stored securely using industry-standard encryption. You may download or delete your documents at any time. Upon account deletion, all associated documents and data will be permanently removed within 30 days.',
  },
  {
    heading: '7. AI Processing & Financial Insights',
    body: 'The Service uses artificial intelligence to analyze document contents for features including chat, tagging, summarization, and expiration detection. AI-generated responses are provided for informational purposes only and should not be treated as legal, financial, or professional advice. We do not guarantee the accuracy, completeness, or reliability of AI-generated content.\n\nFinancial Insights Disclaimer: The Financial Insights feature, including spending analysis, loan analysis, debt optimization suggestions, AI-generated financial recommendations, and any other financial intelligence provided by DocuIntelli AI, is for informational and educational purposes only. DocuIntelli AI does not replace the role of a certified financial advisor, certified financial planner, accountant, or any other licensed financial professional.\n\n\u2022 Users are solely responsible for any financial decisions made based on the information, analysis, or recommendations provided by DocuIntelli AI.\n\u2022 DocuIntelli AI does not provide personalized financial advice, investment advice, tax advice, or legal advice.\n\u2022 AI-generated financial analysis may contain errors, inaccuracies, or outdated information. Always verify financial data independently.\n\u2022 Past financial patterns identified by the Service do not guarantee future results.\n\u2022 You should consult a qualified financial professional before making significant financial decisions, including but not limited to investments, debt management, refinancing, or tax planning.',
  },
  {
    heading: '8. Service Availability',
    body: 'We strive to maintain high availability of the Service but do not guarantee uninterrupted access. The Service may be temporarily unavailable due to maintenance, updates, or circumstances beyond our control. We will make reasonable efforts to notify users of planned maintenance in advance.',
  },
  {
    heading: '9. Limitation of Liability',
    body: 'To the maximum extent permitted by law, DocuIntelli AI and its affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of data, profits, or goodwill, arising out of or in connection with your use of the Service. Our total liability shall not exceed the amount you paid for the Service in the twelve months preceding the claim.',
  },
  {
    heading: '10. Changes to Terms',
    body: 'We reserve the right to modify these Terms at any time. We will notify users of material changes via email or through the Service. Continued use of the Service after changes take effect constitutes acceptance of the revised terms.',
  },
  {
    heading: '11. Contact',
    body: 'If you have questions about these Terms, please contact us at legal@docuintelli.com.',
  },
];

export const PRIVACY_CONTENT: LegalSection[] = [
  {
    heading: 'Privacy Policy',
    body: 'Last updated: February 15, 2026',
  },
  {
    heading: '1. Introduction',
    body: 'DocuIntelli AI ("we", "our", "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and protect your personal information when you use our document management platform. By using DocuIntelli AI, you consent to the practices described in this policy.',
  },
  {
    heading: '2. Information We Collect',
    body: 'Account Information\nWhen you create an account, we collect your email address and display name. If you sign in with Google, we receive your name, email, and profile picture from Google\u2019s authentication service.\n\nDocuments & Content\nWe store the documents you upload, including the file content, metadata (name, category, tags, expiration date), and AI-generated data (text chunks, embeddings, summaries). Document content is processed by our AI systems solely to provide the Service\u2019s features.\n\nUsage Data\nWe collect usage information such as features accessed, documents uploaded, AI token usage, and subscription activity. This data helps us improve the Service and enforce plan limits.',
  },
  {
    heading: '3. How We Use Your Information',
    body: '\u2022 Provide the Service: Store and process your documents, power AI chat and analysis, generate tags and embeddings, and track expirations.\n\u2022 Account Management: Authenticate your identity, manage your subscription, and process payments through Stripe.\n\u2022 Communications: Send transactional emails (document processing notifications, expiration alerts, weekly audits, usage warnings). You can manage notification preferences in Account Settings.\n\u2022 Improvement: Analyze aggregate usage patterns to improve features, performance, and user experience. We do not use your document content for training AI models.',
  },
  {
    heading: '4. Data Storage & Security',
    body: 'Your data is stored in Azure Database for PostgreSQL with the following security measures:\n\n\u2022 Encryption at rest: All data is encrypted using AES-256 encryption at the database level.\n\u2022 Encryption in transit: All data is transmitted over TLS 1.2+.\n\u2022 Row-Level Security (RLS): Database policies ensure users can only access their own documents and data.\n\u2022 File storage: Documents are stored in Azure Blob Storage with access controlled by authenticated signed URLs.\n\u2022 AI processing: Document content is sent to our dedicated AI infrastructure (vLLM) over encrypted connections with Cloudflare Access authentication. Your documents are not stored by the AI processing system beyond the duration of the request.',
  },
  {
    heading: '5. Third-Party Services',
    body: 'We use the following third-party services:\n\n\u2022 Microsoft Azure: Database hosting (Azure Database for PostgreSQL), file storage (Azure Blob Storage), and infrastructure services.\n\u2022 Stripe: Payment processing. We do not store your full credit card details \u2014 Stripe handles all payment information under PCI-DSS Level 1 compliance.\n\u2022 Mailjet: Transactional email delivery for notifications, alerts, and weekly audits.\n\u2022 Cloudflare: CDN, security, and access control for our AI infrastructure.\n\nEach third-party service has its own privacy policy governing their handling of your data. We only share the minimum information necessary for each service to function.',
  },
  {
    heading: '6. Data Retention',
    body: '\u2022 Active accounts: Your documents and account data are retained as long as your account is active.\n\u2022 Deleted documents: When you delete a document, it and all associated data (chunks, embeddings, tags) are permanently removed immediately.\n\u2022 Account deletion: Upon request, all account data including documents, subscription records, and usage logs are permanently deleted within 30 days.\n\u2022 Logs: Usage logs are retained for 30 days, notification logs for 90 days, and limit violation records for 180 days for operational purposes, then automatically purged.',
  },
  {
    heading: '7. Your Rights',
    body: 'You have the right to:\n\n\u2022 Access: Download any of your uploaded documents at any time from the Document Vault.\n\u2022 Correction: Update your profile information from Account Settings.\n\u2022 Deletion: Delete individual documents or request full account deletion.\n\u2022 Portability: Export your documents in their original uploaded format.\n\u2022 Opt-out: Disable email notifications from Account Settings.',
  },
  {
    heading: '8. Children\u2019s Privacy',
    body: 'DocuIntelli AI is not intended for use by children under the age of 16. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us and we will delete that information.',
  },
  {
    heading: '9. Changes to This Policy',
    body: 'We may update this Privacy Policy from time to time. We will notify you of material changes via email or through the Service. The "Last updated" date at the top of this page indicates when this policy was last revised.',
  },
  {
    heading: '10. Contact Us',
    body: 'For privacy-related questions or requests, contact us at privacy@docuintelli.com.',
  },
];

export const COOKIES_CONTENT: LegalSection[] = [
  {
    heading: 'Cookie Policy',
    body: 'Last updated: February 15, 2026',
  },
  {
    heading: '1. What Are Cookies',
    body: 'Cookies are small text files stored on your device when you visit a website. They help the website remember your preferences and improve your browsing experience. DocuIntelli AI uses cookies and similar technologies (such as local storage) to operate the Service.',
  },
  {
    heading: '2. Cookies We Use',
    body: '\u2022 auth-token \u2014 Authentication session managed by custom JWT authentication. Required to keep you signed in. Duration: Session.\n\u2022 auth-token-code-verifier \u2014 PKCE code verifier for secure OAuth flows (Google sign-in). Duration: Session.',
  },
  {
    heading: '3. Local Storage',
    body: 'In addition to cookies, we use browser local storage for the following purposes:\n\n\u2022 Authentication tokens: JWT tokens are stored in local storage to maintain your signed-in state across page reloads.\n\u2022 User preferences: Notification dismissals and UI state preferences are stored locally for a smoother experience.',
  },
  {
    heading: '4. Third-Party Cookies',
    body: 'The following third-party services may set cookies when you use DocuIntelli AI:\n\n\u2022 Stripe: When you visit the payment or billing pages, Stripe may set cookies for fraud detection and payment processing.\n\u2022 Google (OAuth): If you sign in with Google, Google may set cookies during the authentication flow.',
  },
  {
    heading: '5. No Tracking or Analytics Cookies',
    body: 'DocuIntelli AI does not use tracking cookies, advertising cookies, or third-party analytics services such as Google Analytics. We do not track your activity across other websites. The only cookies and storage we use are strictly necessary for the Service to function.',
  },
  {
    heading: '6. Managing Cookies',
    body: 'You can control cookies through your browser settings. Most browsers allow you to block or delete cookies. However, if you disable cookies required for authentication, you will not be able to sign in to DocuIntelli AI. Clearing your browser\u2019s local storage will sign you out.',
  },
  {
    heading: '7. Contact',
    body: 'Questions about our use of cookies? Contact us at privacy@docuintelli.com.',
  },
];
