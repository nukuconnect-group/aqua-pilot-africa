export const PWAUpdatePrompt = () => {
  // Registration and background update checks belong exclusively to pwaRegister.
  // Never activate a waiting worker or reload a page from a mounted screen.
  return null;
};
