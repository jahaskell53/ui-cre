/**
 * Single source of truth for email provider options shown in connect flows.
 * Used by EmailIntegrations (profile/settings), onboarding, and network/connect.
 */
export const EMAIL_PROVIDERS = [
  {
    id: 'gmail',
    name: 'Gmail',
    logo: 'https://www.google.com/gmail/about/static/images/logo-gmail.png',
    icon: '📧',
    description: 'Connect your Gmail account',
    color: 'bg-gray-50 hover:bg-gray-100 border-gray-200',
  },
  {
    id: 'outlook',
    name: 'Outlook',
    logo: 'https://mailmeteor.com/logos/assets/PNG/Microsoft_Office_Outlook_Logo_512px.png',
    icon: '📨',
    description: 'Connect your Outlook account',
    color: 'bg-gray-50 hover:bg-gray-100 border-gray-200',
  },
  // {
  //   id: 'yahoo',
  //   name: 'Yahoo',
  //   logo: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Yahoo%21_%282019%29.svg',
  //   icon: '📮',
  //   description: 'Connect your Yahoo account',
  //   color: 'bg-gray-50 hover:bg-gray-100 border-gray-200',
  // },
  {
    id: 'icloud',
    name: 'iCloud',
    logo: 'https://pluspng.com/logo-img/ic169icl2bd3-icloud-logo-icloud-logopedia-.png',
    icon: '☁️',
    description: 'Connect your iCloud account',
    color: 'bg-gray-50 hover:bg-gray-100 border-gray-200',
  },
] as const;

export type EmailProviderId = (typeof EMAIL_PROVIDERS)[number]['id'];
