# auditLab Wiki

회계사 업무를 **법적 근거가 있는 사실**로 쌓는 위키. 노트 하나에 개념 하나를 담는다. Claude Code가 관리하고, `_site/viewer.html`로 묶어 claude.ai Artifact로 본다.

- 로컬 실행: `python3 wiki/_site/serve.py` → [http://127.0.0.1:8787](http://127.0.0.1:8787) (열 때마다 다시 빌드, 질문은 로컬 `claude -p`, 빈칸은 `_site/gaps.json`)
- claude.ai 뷰어: [https://claude.ai/artifact/7wRgsnvXWz1JKyYFH734TX](https://claude.ai/artifact/7wRgsnvXWz1JKyYFH734TX) (`wiki/_site/viewer.html`을 이 URL로 다시 게시, 빈칸은 Artifact DB `gaps`)
- 원본 자료: `../audit-saas-kb_v3.0_2026-10-21/` (지식베이스 v3.0), `../docs/verification_261021.md` (원문 대조)

## 폴더


| 폴더    | 담는 것                        |
| ----- | --------------------------- |
| 안내    | 시작하기                        |
| 개념    | 감사조서, 중요성처럼 업무 개념           |
| 절차    | 감사 9단계 (`01 …` \~ `09 …`)   |
| 법령    | 조문 하나당 노트 하나 (`외부감사법 제19조`) |
| 주체    | 감사인 유형, 직급, 기관              |
| 기준·서식 | 기준서, 법정 서식                  |


## 노트 형식

```markdown
---
title: 감사조서              # 파일명과 같게
type: 개념                   # 폴더명
aliases: [워킹페이퍼, W/P]   # [[링크]]로도 찾힘
status: verified             # verified=원문 대조 / kb=v3.0 이관, 대조 전 / check=확인할 것 있음
verified: 2026-10-21         # status가 verified일 때만
sources:
  - 국가법령정보센터 | https://www.law.go.kr/법령/주식회사등의외부감사에관한법률/제19조
---

정의 1~3문장.

## 사실
- 사실 한 줄 | 근거(조·항·호) | 등급

## 연결
[[다른 노트]]로 이어지는 설명.

## 확인 필요
- 아직 확인하지 못한 것
```

- 등급은 6개 중 하나: `법률` `시행령·규정` `기준` `감독기관` `관행` `확인 필요`
- 사실 줄은 `|`(앞뒤 공백 있는 세로선)로 세 칸을 나눈다. 본문에 `|`를 쓰지 않는다.
- `## 확인 필요`가 있으면 status는 `check`.

## 관리 규칙 (Claude Code용)

1. **사실만 쓴다.** 기획·아이디어·추측은 넣지 않는다. 모든 사실 줄에 근거와 등급을 단다.
2. **법령은 국가법령정보센터 현행 본문으로 대조한다.** Open API: `https://www.law.go.kr/DRF/lawService.do?OC=test&target=law&type=XML&LM=<법령명>`. 대조하면 status를 `verified`로, 날짜를 갱신한다.
3. **발표일·시행일·적용 보고기간을 구분해 적는다.**
4. **새 자료를 넣을 때**: 관련 노트를 고치거나 새로 만들고, 링크를 잇고, `log.md`에 한 줄 남긴다.
5. **빈칸 목록 채우기**: 뷰어의 "위키에 없는 질문"은 로컬이면 `wiki/_site/gaps.json`, claude.ai면 Artifact DB의 `gaps` 컬렉션(`status: open`)에 쌓인다. `ArtifactData`로 읽고 원문을 찾아 노트를 만든 뒤 해당 문서의 status를 `filled`로 바꾼다.
6. **빌드와 게시**: `python3 wiki/_site/build.py` (깨진 링크가 있으면 실패) → `wiki/_site/viewer.html`을 같은 Artifact URL로 다시 게시.