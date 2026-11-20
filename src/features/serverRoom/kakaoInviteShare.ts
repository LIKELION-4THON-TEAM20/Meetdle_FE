interface KakaoShare {
  init(key: string): void;
  isInitialized(): boolean;
  Share: {
    sendDefault(input: {
      objectType: 'text';
      text: string;
      buttonTitle?: string;
      link: { mobileWebUrl: string; webUrl: string };
    }): void;
  };
}

function sdk() {
  return (window as Window & { Kakao?: KakaoShare }).Kakao;
}

let loading: Promise<KakaoShare> | undefined;

export function prepareKakaoShare() {
  const key = import.meta.env.VITE_KAKAO_SHARE_APP_KEY?.trim();
  if (!key) return Promise.reject(new Error('Kakao Share JavaScript key is missing'));
  if (!loading) {
    loading = new Promise<KakaoShare>((resolve, reject) => {
      const initialize = () => {
        try {
          const kakao = sdk();
          if (!kakao) throw new Error('Kakao Share SDK is unavailable');
          if (!kakao.isInitialized()) kakao.init(key);
          resolve(kakao);
        } catch (error) {
          reject(error);
        }
      };
      if (sdk()) {
        initialize();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.5/kakao.min.js';
      script.integrity = 'sha384-v6JKY3z4FUkWq21oZDHZe74YvuPk/WUrVLrDHTBojHXClOSa3iXy7sCXPY1jkFbj';
      script.crossOrigin = 'anonymous';
      script.onload = initialize;
      script.onerror = () => {
        script.remove();
        reject(new Error('Kakao Share SDK could not load'));
      };
      document.head.append(script);
    }).catch((error) => {
      loading = undefined;
      throw error;
    });
  }
  return loading;
}

export async function shareKakaoInvite(title: string, code: string, inviteUrl: string) {
  return shareKakaoText(`${title.slice(0, 50)} 초대\n초대 코드: ${code}`, inviteUrl);
}

export async function shareKakaoText(text: string, url: string, signal?: AbortSignal) {
  const kakao = await prepareKakaoShare();
  signal?.throwIfAborted();
  kakao.Share.sendDefault({
    objectType: 'text',
    text,
    link: { mobileWebUrl: url, webUrl: url },
  });
}

export async function shareKakaoMessage(
  message: { text: string; url: string; buttonTitle: string },
  signal?: AbortSignal,
) {
  const kakao = await prepareKakaoShare();
  signal?.throwIfAborted();
  kakao.Share.sendDefault({
    objectType: 'text',
    text: message.text,
    buttonTitle: message.buttonTitle,
    link: { webUrl: message.url, mobileWebUrl: message.url },
  });
}
