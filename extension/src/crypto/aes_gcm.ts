/**
 * Client-side AES-256-GCM encryption using Web Crypto API
 * This runs entirely in the browser - no plaintext keys ever leave the client.
 */

export interface EncryptedData {
	nonce: Uint8Array;
	ciphertext: Uint8Array;
}

/**
 * Encrypts plaintext using AES-256-GCM
 */
export async function encrypt(
	plaintext: Uint8Array,
	key: Uint8Array,
): Promise<EncryptedData> {
	if (key.length !== 32) {
		throw new Error("Key must be 32 bytes for AES-256");
	}

	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		key,
		{ name: "AES-GCM" },
		false,
		["encrypt"],
	);

	const nonce = crypto.getRandomValues(new Uint8Array(12));

	const ciphertext = await crypto.subtle.encrypt(
		{
			name: "AES-GCM",
			iv: nonce,
		},
		cryptoKey,
		plaintext,
	);

	return {
		nonce,
		ciphertext: new Uint8Array(ciphertext),
	};
}

/**
 * Decrypts ciphertext using AES-256-GCM
 */
export async function decrypt(
	nonce: Uint8Array,
	ciphertext: Uint8Array,
	key: Uint8Array,
): Promise<Uint8Array> {
	if (key.length !== 32) {
		throw new Error("Key must be 32 bytes for AES-256");
	}

	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		key,
		{ name: "AES-GCM" },
		false,
		["decrypt"],
	);

	const plaintext = await crypto.subtle.decrypt(
		{
			name: "AES-GCM",
			iv: nonce,
		},
		cryptoKey,
		ciphertext,
	);

	return new Uint8Array(plaintext);
}

/**
 * Wraps a DEK using the Master Key (AES-256-GCM)
 */
export async function wrapDek(
	dek: Uint8Array,
	masterKey: Uint8Array,
): Promise<EncryptedData> {
	return encrypt(dek, masterKey);
}

/**
 * Unwraps a DEK using the Master Key
 */
export async function unwrapDek(
	nonce: Uint8Array,
	wrappedDek: Uint8Array,
	masterKey: Uint8Array,
): Promise<Uint8Array> {
	return decrypt(nonce, wrappedDek, masterKey);
}

// Browser-compatible base64 helpers
export function toBase64(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes));
}

export function fromBase64(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}
