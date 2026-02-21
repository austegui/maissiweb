import { NextResponse } from 'next/server';
import { getWhatsAppClient } from '@/lib/whatsapp-client';
import { getConfig } from '@/lib/get-config';

export async function POST(request: Request) {
  try {
    const whatsappClient = await getWhatsAppClient();
    const phoneNumberId = await getConfig('PHONE_NUMBER_ID');

    const formData = await request.formData();
    const to = formData.get('to') as string;
    const body = formData.get('body') as string;
    const file = formData.get('file') as File | null;

    if (!to) {
      return NextResponse.json(
        { error: 'Missing required field: to' },
        { status: 400 }
      );
    }

    // Validate phone number format (digits only, 10-15 chars)
    if (!/^\d{10,15}$/.test(to)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    let result;

    // Send media message
    if (file) {
      // Validate file size (max 16MB)
      const MAX_FILE_SIZE = 16 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: 'File size exceeds 16MB limit' },
          { status: 400 }
        );
      }

      // Validate MIME type
      const ALLOWED_TYPES = [
        'image/', 'video/', 'audio/',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];
      const isAllowedType = ALLOWED_TYPES.some(type =>
        type.endsWith('/') ? file.type.startsWith(type) : file.type === type
      );
      if (!isAllowedType) {
        return NextResponse.json(
          { error: 'File type not allowed' },
          { status: 400 }
        );
      }

      const fileType = file.type.split('/')[0]; // image, video, audio, application
      const mediaType = fileType === 'application' ? 'document' : fileType;

      // Upload media first
      const uploadResult = await whatsappClient.media.upload({
        phoneNumberId,
        type: mediaType as 'image' | 'video' | 'audio' | 'document',
        file: file,
        fileName: file.name
      });

      // Send message with media
      if (mediaType === 'image') {
        result = await whatsappClient.messages.sendImage({
          phoneNumberId,
          to,
          image: { id: uploadResult.id, caption: body || undefined }
        });
      } else if (mediaType === 'video') {
        result = await whatsappClient.messages.sendVideo({
          phoneNumberId,
          to,
          video: { id: uploadResult.id, caption: body || undefined }
        });
      } else if (mediaType === 'audio') {
        result = await whatsappClient.messages.sendAudio({
          phoneNumberId,
          to,
          audio: { id: uploadResult.id }
        });
      } else {
        result = await whatsappClient.messages.sendDocument({
          phoneNumberId,
          to,
          document: { id: uploadResult.id, caption: body || undefined, filename: file.name }
        });
      }
    } else if (body) {
      // Send text message
      result = await whatsappClient.messages.sendText({
        phoneNumberId,
        to,
        body
      });
    } else {
      return NextResponse.json(
        { error: 'Either body or file is required' },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
