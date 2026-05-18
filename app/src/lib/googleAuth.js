import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

export function configureGoogleSignIn() {
  GoogleSignin.configure({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    offlineAccess: false,
    profileImageSize: 120,
  });
}

/**
 * Opens native Google sign-in picker.
 * Returns { email, name } on success.
 * Throws on cancel or error.
 */
export async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();

  if (response.type !== 'success') {
    throw Object.assign(new Error('cancelled'), { code: statusCodes.SIGN_IN_CANCELLED });
  }

  const { email, name } = response.data.user;
  return { email, name: name || email.split('@')[0] };
}

export async function signOutGoogle() {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Ignore — silent sign-out
  }
}
