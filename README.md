# GTO Trainer

9-max 토너먼트 프리플랍 → 플랍 → 턴 → 리버 액션 트레이너. 포지션별 폴드/콜/레이즈(bb 사이즈)를 순서대로 선택하면 해당 스팟의 실제 GTO 차트 기반 핸드 레인지·빈도를 13x13 그리드로 보여주고, 보드 카드를 골라가며 플랍/턴/리버까지 이어서 진행할 수 있다.

**Live**: GitHub Pages로 자동 배포 (아래 Deploy 참고)

## 기능

- 유효스택 선택: 10 / 20 / 30 / 50 / 100 / 200bb
- 포지션(UTG/UTG1/UTG2/MP/HJ/CO/BTN/SB/BB, 9-max) 순서대로 Fold/Call/Raise/Allin 선택 — 한 포지션이 레이즈하면 이후 대응(vs-open/vs-3bet/vs-4bet)이 자동으로 이어지고, 사이 포지션은 자동 폴드 처리
- 포지션 탭을 직접 클릭해 그 포지션으로 바로 이동 가능 — 건너뛴 포지션은 자동 폴드, 이미 결정한 포지션을 다시 클릭하면 그 시점으로 되돌려 재선택
- 각 결정마다 실제 GTO 차트 데이터 기반의 핸드 레인지 + 액션 빈도를 13x13 그리드(셀 내 색상 비율) + 액션별 %/콤보 카드로 표시
- 프리플랍이 끝나면 플랍(3장)/턴/리버 카드를 직접 선택, 컨티뉴잉 레인지의 핸드 카테고리(메이드/드로우/에어) 분포와 참고용 액션 비중 확인. 포지션상 SB부터 액션이 시작(프리플랍은 UTG부터)
- 모바일 반응형

## 데이터 출처 및 한계

- **프리플랍 차트**: [AHTOOOXA/poker-charts](https://github.com/AHTOOOXA/poker-charts)의 "pekarstas" 차트 팩(MIT License, 6-max 100bb 기준)을 참고 데이터로 사용. 9-max의 UTG/UTG1/UTG2/MP는 전용 데이터가 없어 버튼과의 거리가 같은 6-max "UTG" 차트로 매핑(`engine/chart.ts`의 `CHART_POSITION_MAP`), HJ/CO/BTN/SB/BB는 이름이 그대로 대응. 10/20/30/50/200bb는 이 100bb 레인지 구성을 그대로 쓰되, 오픈/3벳/4벳 사이즈와 숏스택(≤20bb) 시 샤브폴드 전환만 스택에 맞게 조정한 것으로, 각 스택·포지션별 독립적인 솔버 결과가 아님.
- **플랍/턴/리버**: 실시간 솔버 연산이 아니라, 보드 텍스처 대비 핸드 카테고리(오버페어/탑페어/드로우/에어 등) 기반의 휴리스틱 참고치.

## 스택

React 19 + TypeScript + Vite + Tailwind CSS v4. 상태는 로컬 컴포넌트 state, 백엔드 없음(정적 SPA).

## 개발

```bash
npm install
npm run dev
```

## 배포

`main` 브랜치에 푸시하면 GitHub Actions(`.github/workflows/deploy.yml`)가 빌드 후 GitHub Pages에 자동 배포한다. 저장소 Settings → Pages → Source를 "GitHub Actions"로 설정해야 한다.
