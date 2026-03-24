# HTML/CSS/JSON/JS 변환본

이 폴더는 업로드한 React 대시보드를 순수 HTML/CSS/JSON/JS 구조로 재구성한 버전입니다.

## 파일 구조

- `index.html` : 홈 화면
- `dashboard.html` : 프로젝트 상세 대시보드
- `css/style.css` : 전체 스타일
- `js/common.js` : 공통 유틸, CSV 파서, localStorage 처리
- `js/home.js` : 홈 화면 렌더링
- `js/dashboard.js` : 대시보드 렌더링 및 상세 수정 모달
- `data/team-members.json` : 팀원 데이터
- `data/default-projects.json` : 기본 프로젝트 데이터
- `data/csv-template.csv` : 업로드용 예시 CSV

## 사용 방법

1. VS Code에서 이 폴더를 엽니다.
2. `index.html`을 바로 더블클릭해도 동작은 하지만, JSON 파일 로딩 때문에 **Live Server** 같은 로컬 서버 실행을 권장합니다.
3. 현재 주차 CSV를 업로드하면 `localStorage`에 저장됩니다.
4. 이전 주차 CSV를 업로드하면 상세 보기에서 비교용으로 사용됩니다.

## 유지된 기능

- CSV 업로드 후 프로젝트 데이터 반영
- 홈 화면에서 프로젝트별 / 팀원별 보기 전환
- 셀별 프로젝트 현황 확인
- 대시보드 필터(셀/상태/우선순위/PM)
- 프로젝트 카드에서 이름/PM/상태/우선순위/진행률 즉시 수정
- 상세 보기 모달에서 프로젝트 정보, 피드백, 팀원 역할 수정
- 이전 주차 데이터와 비교한 간단한 주간 변화 분석

## 참고

- 기본 프로젝트 데이터로 예시 4건을 넣어두었습니다. 실제 사용 시 `data/csv-template.csv`를 참고해 CSV를 업로드하면 현재 데이터가 교체됩니다.
- 저장 데이터는 브라우저 `localStorage`에 남습니다.
