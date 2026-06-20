# Google Play Release

이 프로젝트는 Capacitor로 Android 앱 패키징이 설정되어 있습니다.

## 현재 앱 설정

- App name: `Medical Studycat`
- Package ID: `kr.medicalstudycat.app`
- Web build folder: `dist`
- Android project: `android/`

Package ID는 Google Play에 처음 출시한 뒤 바꾸기 어렵습니다. 출시 전 최종 이름이 필요하면 `capacitor.config.ts`의 `appId`와 Android 패키지명을 먼저 확정하세요.

## 빌드 준비

1. Android Studio 설치
2. JDK 설치 또는 Android Studio 내장 JBR 사용
3. Android SDK 설치
4. 프로젝트 루트에서 실행:

```bash
npm install
npm run android:sync
npm run android:open
```

## AAB 만들기

Android Studio에서:

1. `Build > Generate Signed App Bundle / APK`
2. `Android App Bundle` 선택
3. 새 upload key 생성 또는 기존 keystore 선택
4. `release` 빌드 생성

생성 위치:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

## Google Play Console 업로드

1. Play Console에서 새 앱 생성
2. 앱 이름, 기본 언어, 앱/게임, 무료/유료 선택
3. 스토어 등록정보 작성
4. 앱 콘텐츠, 개인정보처리방침, 데이터 보안, 타겟 연령 설정
5. 내부 테스트 트랙에 `app-release.aab` 업로드
6. 테스트 후 프로덕션 트랙으로 승격

## 주의

- `*.jks`, `*.keystore`, `android/key.properties`는 커밋하지 않습니다.
- 모바일 앱은 Vite 개발 프록시를 사용할 수 없어서 `.env.production`에 실제 API 주소를 넣었습니다.
- API 서버가 `https://localhost` 또는 Capacitor WebView origin의 CORS 요청을 허용하지 않으면 앱에서 실시간 연동이 막힐 수 있습니다. 이 경우 서버 CORS 설정 또는 네이티브 HTTP 플러그인 적용이 필요합니다.
