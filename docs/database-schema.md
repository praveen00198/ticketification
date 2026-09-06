# Database Schema Specifications (MongoDB / Mongoose)

## Users Collection (`users`)
```typescript
interface IUser {
  _id: ObjectId;
  name: string;
  email: string; // Unique index
  passwordHash: string;
  role: 'ADMIN';
  createdAt: Date;
  updatedAt: Date;
}
```

## Tickets Collection (`tickets`)
```typescript
interface ITicket {
  _id: ObjectId;
  ticketId: string;                     // e.g. "EVT26-000001", Unique index
  verificationToken: string;            // Cryptographic random token, Unique index
  name: string;
  phone?: string;                       // E.164 format (e.g. "+919876543210"), indexed
  email?: string;
  event: string;
  eventDate: Date;
  ticketType: string;
  organization?: string;
  designation?: string;
  status: 'ACTIVE' | 'USED' | 'CANCELLED' | 'EXPIRED';
  deliveryProvider: 'WHATSAPP' | 'EMAIL';
  deliveryStatus: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';
  providerMessageId?: string;           // Meta WAMID or Resend message ID
  ticketImageUrl?: string;              // HTTP URL to rendered ticket PNG card
  pdfPath?: string;
  usedAt?: Date;
  verifiedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
```
Indexes: `ticketId` (unique), `verificationToken` (unique), `phone`, `email`, `status`, `deliveryStatus`.
