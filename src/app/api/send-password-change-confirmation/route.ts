import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
  try {
    const { to, confirmUrl } = await req.json();
    if (!to || !confirmUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Configure nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'iaaoamar12@gmail.com', // <-- Your Gmail address
        pass: 'ncmzlyghjgzrfzoc',     // <-- Your app password
      },
    });
    // NOTE: For production, use environment variables instead of hardcoding credentials.

    // Email content
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: 'Confirm your password change',
      html: `
        <h2>Password Change Confirmation</h2>
        <p>You requested to change your password. Please confirm this change by clicking the link below:</p>
        <p><a href="${confirmUrl}" style="color:#7C3AED;">Confirm Password Change</a></p>
        <p>This link is valid for 10 minutes. If you did not request this change, please ignore this email.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error sending password change confirmation email:', error);
    return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 });
  }
} 