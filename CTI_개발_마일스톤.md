# CTI 위협 인텔리전스 플랫폼 — 개발 마일스톤

> **기술 스택**: Node.js (Express/Fastify) + React + StealthMole API + LLM (Claude API)
> **예상 총 기간**: 7 Sprint (Sprint = 1~2주), 약 10~14주

---
![alt text](image.png)

## M1. Chat UI & 파일 업로드 (Sprint 1)

**목표**: 분석가가 침해 사고 파일을 업로드하고, 대화형으로 분석을 시작할 수 있는 기본 인터페이스

**범위**:
- ChatGPT 스타일의 대화형 UI 프레임 구축 (React)
- 파일 업로드 영역: drag & drop + 클릭 업로드
- 지원 파일 형식: `.log`, `.txt`, `.csv`, `.json`, `.pcap`(메타데이터만), `.eml`, `.pdf`
- 업로드된 파일의 미리보기 (텍스트 파일은 내용 표시, 바이너리는 메타데이터 표시)
- 대화 세션 관리 (세션별 파일·결과 격리)
- 백엔드: Express/Fastify 기반 REST API, 파일 저장 (로컬 또는 S3), WebSocket 준비

**산출물**:
- `/api/sessions` — 세션 CRUD
- `/api/upload` — 파일 업로드 엔드포인트
- 프론트엔드: ChatWindow, FileUpload, MessageBubble 컴포넌트
- 파일 파서 인터페이스 정의 (`IFileParser`)

**완료 기준**: 파일을 업로드하면 대화창에 파일 정보가 표시되고, 백엔드에 저장됨

---

## M2. IOC 추출 엔진 (Sprint 2)

**목표**: 업로드된 파일에서 IOC를 기계적 + LLM 기반으로 추출

### M2a. Regex 기반 기계적 파싱

**범위**:
- IOC 유형별 정규표현식 모듈
  - 네트워크: IPv4, IPv6, 도메인, URL, 이메일
  - 파일: MD5, SHA1, SHA256, 파일명 패턴
  - 금융: BTC 주소(Legacy + Bech32), ETH 주소
  - 메신저: 텔레그램 핸들, 디스코드 ID
  - 인프라: CVE ID, MITRE ATT&CK ID
- Defanging 처리 (`hxxp://`, `[.]` 등 → 정상 형식으로 복원)
- 추출 결과를 표준 IOC 객체로 정규화

```
IOC 객체 스키마:
{
  id: string,
  type: "ipv4" | "domain" | "email" | "md5" | "sha256" | "url" | "btc_address" | "eth_address" | ...,
  value: string,               // 정규화된 값
  raw_value: string,           // 원문 그대로
  source_file: string,         // 출처 파일명
  line_number: number,         // 파일 내 위치
  offset: { start, end },     // 문자 오프셋 (하이라이팅용)
  context: string,             // 전후 50자 컨텍스트
  confidence: number,          // 0~1 (regex = 1.0, LLM = 가변)
  extraction_method: "regex" | "llm"
}
```

### M2b. LLM 기반 의미론적 추출

**범위**:
- Claude API 연동 모듈
- 프롬프트 설계: 파일 청크를 입력하여 IOC + 컨텍스트 추출
  - Regex가 놓치는 변형 IOC (난독화, 줄바꿈 포함, 자연어 내 포함)
  - 위협 행위자 이름/별칭, 캠페인명, 악성코드명 등 의미론적 엔티티
  - 각 IOC의 맥락 분류 (공격자 인프라 vs 피해자 자산 vs 무관)
- 긴 파일 처리를 위한 청킹(chunking) 전략
- Regex 결과와 LLM 결과 병합 (중복 제거, confidence 가중)

**산출물**:
- `/api/extract` — 파일 ID를 받아 IOC 목록 반환
- `IocExtractor` 클래스 (RegexExtractor + LlmExtractor 조합)
- IOC 결과 저장소 (세션별 IOC 테이블)

**완료 기준**: 샘플 로그 파일 업로드 시 IOC 목록이 대화창에 타입별로 분류되어 표시됨

---

## M3. StealthMole API 게이트웨이 (Sprint 3)

**목표**: 추출된 IOC를 StealthMole API로 자동 쿼리하고 결과를 수집·캐싱

**범위**:
- StealthMole JWT 인증 모듈 (Access Key + Secret Key → 토큰 발급·갱신)
- IOC 유형 → StealthMole 모듈 자동 라우팅

```
IOC 유형별 API 라우팅 테이블:
  email      → DT(email:), CL(email:)
  domain     → DT(domain:), CL(domain:)
  ipv4       → DT(ip:), CDS(ip:)
  btc_address → DT(bitcoin:)
  eth_address → DT(ethereum:)
  url        → DT(url:)
  telegram   → TT(query:), DT(telegram:)
  keyword    → DT(keyword:)
  md5/sha256 → DT(hash:)
```

- Rate Limiter: API 호출 속도 제한 관리
- 결과 캐싱: IOC 값 + 모듈 조합을 키로 Redis/메모리 캐시 (TTL: 1h)
- 비동기 병렬 쿼리: 여러 IOC를 동시에 다른 모듈로 전송
- API 응답 정규화: 모듈별로 다른 응답 구조를 통합 스키마로 변환

```
통합 API 결과 스키마:
{
  query_ioc: { type, value },
  module: "dt" | "cl" | "cds" | "tt" | "rm",
  results_count: number,
  results: [
    {
      id: string,
      source_url: string,
      title: string,               // 게시글 제목 또는 요약
      content: string,             // 본문 전체
      timestamp: ISO8601,
      forum_name: string,
      author_alias: string,
      indicators_tagged: string[], // StealthMole이 태깅한 지표
      raw_response: object         // 원본 응답 보존
    }
  ],
  cached: boolean,
  queried_at: ISO8601
}
```

- 쿼리 이력 관리: 어떤 IOC로 어떤 모듈을 쿼리했는지 추적

**산출물**:
- `/api/query` — IOC 목록을 받아 StealthMole 쿼리 실행
- `StealthMoleClient` 클래스 (인증, 쿼리, 캐싱 통합)
- 프론트엔드: 쿼리 진행 상태 표시 (진행률 바, 모듈별 상태)

**완료 기준**: IOC 추출 후 자동으로 StealthMole 쿼리가 실행되고, 결과 건수가 대화창에 표시됨

---

## M4. 검색 엔진형 결과 리스팅 (Sprint 4)

**목표**: StealthMole에서 반환된 문서들을 검색 엔진처럼 리스팅

**범위**:
- 검색 결과 리스트 UI
  - 각 결과: 제목, 출처(포럼명), 날짜, 본문 스니펫(IOC 하이라이트 포함), 관련 IOC 태그
  - Google 검색 결과와 유사한 레이아웃
- 정렬 옵션: 관련도순, 최신순, 소스별
- 필터링: 모듈별(DT/CL/TT/CDS), 날짜 범위, IOC 유형별
- 페이지네이션 (cursor 기반, StealthMole API의 cursor 활용)
- 검색창: 기존 IOC 재검색 또는 새 키워드 검색
- 결과 카운트 표시 (모듈별 분포 차트)

**산출물**:
- `SearchResultList`, `ResultCard`, `FilterPanel`, `SortDropdown` 컴포넌트
- `/api/results/:sessionId` — 세션별 쿼리 결과 조회
- 결과 내 텍스트 검색 (로컬 full-text search)

**완료 기준**: StealthMole 결과가 검색 결과 형태로 리스팅되고, 필터·정렬이 동작함

---

## M5. 문서 뷰어 + IOC/의미론적 하이라이팅 (Sprint 5)

**목표**: 분석가가 개별 문서를 클릭했을 때, IOC와 의미론적 중요 부분이 하이라이팅된 상태로 표시

### M5a. IOC 하이라이팅 + 클릭 검색

**범위**:
- 문서 상세 뷰어 (사이드 패널 또는 전체 페이지)
- 본문 내 IOC 자동 하이라이팅
  - IOC 유형별 색상 코드 (IP=파랑, 해시=보라, 이메일=초록, 지갑=주황 등)
  - 호버 시 툴팁: IOC 유형, defanged 여부, 이전 검색 결과 요약
- **클릭 → 즉시 검색**: IOC를 클릭하면 해당 값으로 StealthMole 재쿼리
  - 사이드바에 검색 결과가 즉시 로딩
  - 기존 결과 화면에서 벗어나지 않음 (split view)
- **드래그 → 검색**: 본문 텍스트를 마우스로 드래그 선택하면 컨텍스트 메뉴에 "이 키워드로 검색" 옵션

### M5b. LLM 의미론적 하이라이팅

**범위**:
- 문서 본문을 LLM에 전송하여 위협 관련 의미론적 정보를 식별
  - 위협 행위자 동기/의도 서술 부분
  - 공격 기법 설명 부분
  - 거래/협상 맥락 (가격, 조건, 연락처)
  - 피해자 정보 언급 부분
- 하이라이팅 유형별 구분 (IOC 하이라이트와 다른 스타일)
  - IOC = 단색 배경 칩
  - 의미론적 = 밑줄 + 사이드 마커 (위협, 동기, 거래, 피해자)
- 하이라이팅 토글: IOC만 / 의미론적만 / 전체 / 끄기
- LLM 결과 캐싱 (동일 문서 재방문 시 재분석 불필요)

**산출물**:
- `DocumentViewer`, `HighlightedText`, `IocChip`, `SemanticMarker` 컴포넌트
- `/api/documents/:id` — 문서 본문 + 하이라이팅 메타데이터 반환
- `/api/documents/:id/semantic` — LLM 의미론적 분석 결과
- 컨텍스트 메뉴 컴포넌트 (드래그 선택 시 검색 옵션)

**완료 기준**: 문서 클릭 시 IOC가 색상별로 하이라이팅되고, 클릭/드래그로 즉시 재검색이 가능함

---

## M6. Entity Resolution & 지식 그래프 (Sprint 6)

**목표**: 여러 문서에 걸쳐 나타나는 식별자들을 동일인 해소하여 위협 행위자 프로필 구축

**범위**:
- 세션 내 수집된 모든 문서에서 식별자 수집·인덱싱
- Blocking: 동일 식별자(이메일, 텔레그램 핸들, 지갑 주소) 공유 레코드 그룹핑
- LLM 기반 Pairwise Matching
  - 후보 쌍에 대해 Claude API로 동일인 판정
  - Deterministic Rule 우선 적용 (동일 이메일 → 자동 매칭)
  - 판정 결과: is_same_entity, confidence, reasoning, evidence
- Union-Find 기반 클러스터링 → 통합 엔티티 생성
- 엔티티 프로필 카드 UI
  - 별칭 목록, 연결된 IOC 목록, 활동 타임라인
  - Confidence 점수 표시 (출처 기반)
  - 판정 근거 열람 (merge_log)

```
엔티티 프로필 스키마:
{
  entity_id: string,
  canonical_name: string,
  confidence: number,
  aliases: [{ value, source, confidence }],
  emails: [{ value, source, confidence }],
  wallets: [{ chain, address, source, confidence }],
  handles: [{ platform, value, source, confidence }],
  activity_timeline: [{ date, event_type, source_doc_id }],
  merge_log: [{ step, records, evidence, confidence, rule }],
  related_entities: [{ entity_id, relationship, confidence }]
}
```

**산출물**:
- `EntityResolver` 클래스 (Blocker + Matcher + Clusterer)
- `/api/entities/:sessionId` — 세션 내 해소된 엔티티 목록
- `/api/entities/:entityId` — 개별 엔티티 프로필
- `EntityCard`, `MergeLogViewer` 컴포넌트

**완료 기준**: 여러 문서에서 동일인을 사용하는 별칭들이 하나의 엔티티 카드로 통합되어 표시됨

---

## M7. 그래프 시각화 & 대시보드 (Sprint 7)

**목표**: Entity Resolution 결과를 인터랙티브 그래프로 시각화하고, 세션 전체 분석 대시보드 제공

**범위**:
- 인터랙티브 지식 그래프 (vis.js 또는 D3 force-directed)
  - 노드: 위협 행위자, 이메일, 지갑, 텔레그램 핸들, 다크웹 게시글
  - 엣지: uses, alias_of, authored, funds_to
  - 노드 크기 = 연결 수, 엣지 두께 = confidence
  - 노드 클릭 → 상세 패널 (엔티티 카드 또는 문서 뷰어)
  - 줌, 패닝, 필터 (엣지 유형별, confidence 임계값)
- 대시보드 요약
  - 총 수집 문서 수, 추출 IOC 수, 해소된 엔티티 수
  - IOC 유형별 분포 차트
  - 활동 타임라인 (시계열 히트맵)
  - 가장 많이 연결된 엔티티 TOP 5
- STIX 2.1 Bundle 내보내기 (JSON 다운로드)

**산출물**:
- `KnowledgeGraph`, `GraphNode`, `GraphEdge`, `GraphFilter` 컴포넌트
- `Dashboard`, `TimelineHeatmap`, `IocDistributionChart` 컴포넌트
- `/api/graph/:sessionId` — 그래프 데이터 (nodes + edges)
- `/api/export/:sessionId/stix` — STIX Bundle 내보내기

**완료 기준**: 엔티티 관계가 인터랙티브 그래프로 시각화되고, STIX 내보내기가 동작함

---

## 마일스톤 간 의존성 요약

```
M1 (Chat UI) ←── 독립, 최우선
 │
 ▼
M2 (IOC 추출) ←── M1 완료 필요 (파일 업로드 기반)
 │
 ▼
M3 (API 게이트웨이) ←── M2 완료 필요 (추출된 IOC 기반)
 │
 ├──▶ M4 (결과 리스팅) ←── M3 완료 필요
 │     │
 │     ▼
 │    M5 (문서 뷰어) ←── M4 완료 필요 (문서 클릭 진입점)
 │
 └──▶ M6 (Entity Resolution) ←── M3 완료 필요 (수집된 문서 기반)
       │                          M5와 병렬 가능
       ▼
      M7 (그래프 시각화) ←── M5 + M6 모두 필요
```

**병렬화 가능 구간**: M4~M5와 M6는 독립적이므로 두 트랙으로 병렬 진행 가능. 이 경우 총 기간을 ~2주 단축 가능.

---

## 기술적 결정 사항 (Sprint 0에서 확정 필요)

| 결정 사항 | 선택지 | 권장 |
|-----------|--------|------|
| 프론트엔드 프레임워크 | React / Next.js / Vue | 기존 레포 기반 결정 |
| 백엔드 프레임워크 | Express / Fastify / NestJS | Express (범용성) |
| 데이터베이스 | SQLite / PostgreSQL / MongoDB | SQLite (프로토타입) → PostgreSQL |
| 캐싱 | 인메모리 / Redis | 인메모리 Map (MVP) |
| LLM API | Claude API / OpenAI | Claude API (Anthropic 제공) |
| 그래프 시각화 | vis.js / D3.js / Cytoscape.js | vis.js (빠른 프로토타이핑) |
| 실시간 통신 | Polling / SSE / WebSocket | SSE (LLM 스트리밍에 적합) |
| StealthMole API 키 | 무료 플랜 / 유료 구독 | 유료 확보 필요 (마스킹 해제) |

---

## 리스크 & 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| StealthMole API 키 미확보 | M3 이후 전체 블로킹 | Mock API 서버로 M4~M7 병렬 개발 |
| LLM 비용 초과 | M2b, M5b, M6 비용 급증 | Regex 우선 처리 + LLM 호출 최소화 (캐싱, 배치) |
| API Rate Limit | M3 쿼리 속도 제한 | 큐잉 + 우선순위 기반 비동기 처리 |
| 대용량 파일 처리 | M2 메모리/시간 초과 | 스트림 파싱 + 청킹 (100KB 단위) |
| Entity Resolution 오탐 | M6 신뢰도 하락 | Deterministic Rule 우선 + 분석가 수동 검증 UI |
