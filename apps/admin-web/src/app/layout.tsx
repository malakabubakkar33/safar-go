import React from 'react';

export const metadata = {
  title: 'SafarGo Admin Portal',
  description: 'Operations and Management Console for SafarGo Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
