import { z } from 'zod';

/**
 * Schémas de validation pour sécuriser les entrées utilisateur
 * Prévient les injections, les données corrompues et les abus
 */

// Schéma pour les transactions
export const transactionSchema = z.object({
  type: z.enum(['purchase', 'sale'], {
    required_error: "Le type de transaction est requis",
  }),
  productName: z.string()
    .trim()
    .min(1, { message: "Le nom du produit ne peut pas être vide" })
    .max(200, { message: "Le nom du produit ne peut pas dépasser 200 caractères" }),
  quantity: z.number()
    .positive({ message: "La quantité doit être positive" })
    .max(1000000, { message: "La quantité ne peut pas dépasser 1 000 000" })
    .finite({ message: "La quantité doit être un nombre valide" }),
  unitPrice: z.number()
    .positive({ message: "Le prix unitaire doit être positif" })
    .max(100000, { message: "Le prix unitaire ne peut pas dépasser 100 000" })
    .finite({ message: "Le prix unitaire doit être un nombre valide" }),
  clientName: z.string()
    .trim()
    .max(200, { message: "Le nom du client ne peut pas dépasser 200 caractères" })
    .optional(),
  supplierName: z.string()
    .trim()
    .max(200, { message: "Le nom du fournisseur ne peut pas dépasser 200 caractères" })
    .optional(),
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Format de date invalide (YYYY-MM-DD)" }),
  notes: z.string()
    .trim()
    .max(1000, { message: "Les notes ne peuvent pas dépasser 1000 caractères" })
    .optional()
    .default(''),
  status: z.enum(['pending', 'completed', 'cancelled'], {
    required_error: "Le statut est requis",
  }),
});

// Schéma pour les clients
export const clientSchema = z.object({
  name: z.string()
    .trim()
    .min(1, { message: "Le nom ne peut pas être vide" })
    .max(200, { message: "Le nom ne peut pas dépasser 200 caractères" }),
  email: z.string()
    .trim()
    .email({ message: "L'adresse email est invalide" })
    .max(255, { message: "L'email ne peut pas dépasser 255 caractères" }),
  phone: z.string()
    .trim()
    .min(1, { message: "Le téléphone ne peut pas être vide" })
    .max(20, { message: "Le téléphone ne peut pas dépasser 20 caractères" })
    .regex(/^[0-9\s+().-]+$/, { message: "Le t�l�phone contient des caract�res invalides" }),
  address: z.string()
    .trim()
    .min(1, { message: "L'adresse ne peut pas être vide" })
    .max(500, { message: "L'adresse ne peut pas dépasser 500 caractères" }),
  status: z.enum(['potential', 'active', 'inactive'], {
    required_error: "Le statut est requis",
  }),
});

// Schéma pour les éléments de facture
export const invoiceItemSchema = z.object({
  description: z.string()
    .trim()
    .min(1, { message: "La description ne peut pas être vide" })
    .max(500, { message: "La description ne peut pas dépasser 500 caractères" }),
  quantity: z.number()
    .positive({ message: "La quantité doit être positive" })
    .max(1000000, { message: "La quantité ne peut pas dépasser 1 000 000" })
    .finite({ message: "La quantité doit être un nombre valide" }),
  unitPrice: z.number()
    .positive({ message: "Le prix unitaire doit être positif" })
    .max(100000, { message: "Le prix unitaire ne peut pas dépasser 100 000" })
    .finite({ message: "Le prix unitaire doit être un nombre valide" }),
});

// Schéma pour les factures
export const invoiceSchema = z.object({
  invoiceNumber: z.string()
    .trim()
    .min(1, { message: "Le numéro de facture ne peut pas être vide" })
    .max(50, { message: "Le numéro de facture ne peut pas dépasser 50 caractères" })
    .regex(/^[A-Z0-9-]+$/, { message: "Le numéro de facture ne peut contenir que des lettres majuscules, chiffres et tirets" }),
  clientName: z.string()
    .trim()
    .min(1, { message: "Le nom du client ne peut pas être vide" })
    .max(200, { message: "Le nom du client ne peut pas dépasser 200 caractères" }),
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Format de date invalide (YYYY-MM-DD)" }),
  dueDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Format de date d'échéance invalide (YYYY-MM-DD)" }),
  items: z.array(invoiceItemSchema)
    .min(1, { message: "Une facture doit contenir au moins un article" })
    .max(100, { message: "Une facture ne peut pas contenir plus de 100 articles" }),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'proforma'], {
    required_error: "Le statut est requis",
  }),
  transactionId: z.string().optional(),
});

// Schéma pour les commandes
export const orderSchema = z.object({
  clientId: z.string()
    .trim()
    .min(1, { message: "L'ID du client est requis" }),
  clientName: z.string()
    .trim()
    .min(1, { message: "Le nom du client ne peut pas être vide" })
    .max(200, { message: "Le nom du client ne peut pas dépasser 200 caractères" }),
  productType: z.string()
    .trim()
    .min(1, { message: "Le type de produit ne peut pas être vide" })
    .max(200, { message: "Le type de produit ne peut pas dépasser 200 caractères" }),
  quantity: z.number()
    .positive({ message: "La quantité doit être positive" })
    .max(1000000, { message: "La quantité ne peut pas dépasser 1 000 000" })
    .finite({ message: "La quantité doit être un nombre valide" }),
  unitPrice: z.number()
    .positive({ message: "Le prix unitaire doit être positif" })
    .max(100000, { message: "Le prix unitaire ne peut pas dépasser 100 000" })
    .finite({ message: "Le prix unitaire doit être un nombre valide" }),
  status: z.enum(['pending', 'processing', 'delivered', 'cancelled'], {
    required_error: "Le statut est requis",
  }),
  orderDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Format de date invalide (YYYY-MM-DD)" }),
  deliveryDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Format de date de livraison invalide (YYYY-MM-DD)" })
    .optional(),
});

// Types TypeScript dérivés des schémas
export type TransactionInput = z.infer<typeof transactionSchema>;
export type ClientInput = z.infer<typeof clientSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
