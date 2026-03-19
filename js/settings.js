/* ================================================
   BIZCOACH 설정 페이지 JavaScript
   ================================================ */

// 스택 데이터 (localStorage에 저장)
let stackData = JSON.parse(localStorage.getItem('stackData')) || [];
let editingStackId = null; // 수정 중인 스택 ID
let editingRow = null; // 수정 중인 테이블 행

// 모달 열기 (추가 모드)
function openAddStackModal() {
  editingStackId = null;
  editingRow = null;
  document.getElementById('stackModal').classList.add('open');
  document.getElementById('stackForm').reset();
  document.getElementById('credentialFields').style.display = 'block';
  document.querySelector('#stackModal .modal-title').textContent = '스택 추가';
}

// 모달 닫기
function closeStackModal() {
  document.getElementById('stackModal').classList.remove('open');
}

// Google 연동 체크박스 토글
function toggleGoogleLinked() {
  const isChecked = document.getElementById('isGoogleLinked').checked;
  const credentialFields = document.getElementById('credentialFields');

  if (isChecked) {
    credentialFields.style.display = 'none';
  } else {
    credentialFields.style.display = 'block';
  }
}

// 스택 저장
function saveStack() {
  const serviceName = document.getElementById('serviceName').value;
  const serviceType = document.getElementById('serviceType').value;
  const isGoogleLinked = document.getElementById('isGoogleLinked').checked;
  const serviceId = document.getElementById('serviceId').value;
  const servicePw = document.getElementById('servicePw').value;
  const serviceUrl = document.getElementById('serviceUrl').value;
  const serviceNote = document.getElementById('serviceNote').value;

  if (!serviceName) {
    alert('서비스명을 입력해주세요.');
    return;
  }

  // 수정 모드
  if (editingRow) {
    // 테이블 행 직접 업데이트
    updateTableRow(editingRow, {
      name: serviceName,
      type: serviceType,
      isGoogleLinked: isGoogleLinked,
      accountId: isGoogleLinked ? '' : serviceId,
      url: serviceUrl,
      note: serviceNote
    });

    // localStorage에 저장된 데이터도 업데이트
    if (editingStackId) {
      const idx = stackData.findIndex(s => s.id === parseInt(editingStackId));
      if (idx !== -1) {
        stackData[idx] = {
          ...stackData[idx],
          name: serviceName,
          type: serviceType,
          isGoogleLinked: isGoogleLinked,
          accountId: isGoogleLinked ? '' : serviceId,
          password: servicePw || stackData[idx].password,
          url: serviceUrl,
          note: serviceNote
        };
        localStorage.setItem('stackData', JSON.stringify(stackData));
      }
    }

    closeStackModal();
    alert('스택이 수정되었습니다.');
    return;
  }

  // 추가 모드
  const newStack = {
    id: Date.now(),
    name: serviceName,
    type: serviceType,
    isGoogleLinked: isGoogleLinked,
    accountId: isGoogleLinked ? '' : serviceId,
    password: isGoogleLinked ? '' : servicePw,
    url: serviceUrl,
    note: serviceNote
  };

  stackData.push(newStack);
  localStorage.setItem('stackData', JSON.stringify(stackData));

  addStackToTable(newStack);
  closeStackModal();

  alert('스택이 추가되었습니다.');
}

// 테이블 행 업데이트
function updateTableRow(tr, data) {
  const cells = tr.querySelectorAll('td');

  // 서비스명/유형
  cells[0].innerHTML = `
    <div class="service-name">
      <span class="service-icon">🔧</span>
      <div>
        <strong>${data.name}</strong>
        <small>${data.type || '-'}</small>
      </div>
    </div>
  `;

  // ID/계정
  if (data.isGoogleLinked) {
    cells[1].innerHTML = '<span class="badge badge-google">Google 연동</span>';
    cells[2].innerHTML = '<span class="pw-mask">-</span>';
  } else {
    cells[1].innerHTML = `<code>${data.accountId || '-'}</code>`;
    cells[2].innerHTML = '<span class="pw-mask">••••••••</span>';
  }

  // URL
  if (data.url) {
    cells[3].innerHTML = `<a href="${data.url}" target="_blank">${data.url.replace('https://', '')}</a>`;
  } else {
    cells[3].innerHTML = '-';
  }

  // 특이사항
  cells[4].innerHTML = data.note || '-';
}

// 테이블에 스택 추가
function addStackToTable(stack) {
  const tbody = document.getElementById('stackTableBody');
  const tr = document.createElement('tr');
  tr.dataset.id = stack.id;

  tr.innerHTML = `
    <td>
      <div class="service-name">
        <span class="service-icon">🔧</span>
        <div>
          <strong>${stack.name}</strong>
          <small>${stack.type || '-'}</small>
        </div>
      </div>
    </td>
    <td>${stack.isGoogleLinked ? '<span class="badge badge-google">Google 연동</span>' : '<code>' + (stack.accountId || '-') + '</code>'}</td>
    <td><span class="pw-mask">${stack.isGoogleLinked ? '-' : '••••••••'}</span></td>
    <td>${stack.url ? '<a href="' + stack.url + '" target="_blank">' + stack.url.replace('https://', '') + '</a>' : '-'}</td>
    <td>${stack.note || '-'}</td>
    <td>
      <button class="btn-icon" onclick="editStack(this)" title="수정">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="btn-icon btn-icon-danger" onclick="deleteStack(this)" title="삭제">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </td>
  `;

  tbody.appendChild(tr);
}

// 스택 수정
function editStack(button) {
  const tr = button.closest('tr');
  editingRow = tr;
  editingStackId = tr.dataset.id || null;

  // 테이블에서 데이터 추출
  const cells = tr.querySelectorAll('td');

  // 서비스명/유형
  const serviceNameEl = cells[0].querySelector('strong');
  const serviceTypeEl = cells[0].querySelector('small');
  const serviceName = serviceNameEl ? serviceNameEl.textContent : '';
  const serviceType = serviceTypeEl ? serviceTypeEl.textContent : '';

  // ID/계정
  const accountCell = cells[1];
  const isGoogleLinked = accountCell.querySelector('.badge-google') !== null;
  const accountIdEl = accountCell.querySelector('code');
  const accountId = accountIdEl ? accountIdEl.textContent : '';

  // URL
  const urlCell = cells[3];
  const urlLink = urlCell.querySelector('a');
  const serviceUrl = urlLink ? urlLink.href : '';

  // 특이사항
  const noteCell = cells[4];
  const serviceNote = noteCell.textContent.trim();

  // 모달에 데이터 채우기
  document.getElementById('serviceName').value = serviceName;
  document.getElementById('serviceType').value = serviceType !== '-' ? serviceType : '';
  document.getElementById('isGoogleLinked').checked = isGoogleLinked;
  document.getElementById('serviceId').value = accountId;
  document.getElementById('servicePw').value = ''; // 보안상 비밀번호는 빈칸
  document.getElementById('serviceUrl').value = serviceUrl;
  document.getElementById('serviceNote').value = serviceNote !== '-' ? serviceNote : '';

  // Google 연동 체크에 따라 필드 표시
  document.getElementById('credentialFields').style.display = isGoogleLinked ? 'none' : 'block';

  // 모달 열기
  document.querySelector('#stackModal .modal-title').textContent = '스택 수정';
  document.getElementById('stackModal').classList.add('open');
}

// 스택 삭제
function deleteStack(button) {
  if (!confirm('정말 삭제하시겠습니까?')) return;

  const tr = button.closest('tr');
  const id = tr.dataset.id;

  // localStorage에서 삭제
  if (id) {
    stackData = stackData.filter(s => s.id !== parseInt(id));
    localStorage.setItem('stackData', JSON.stringify(stackData));
  }

  tr.remove();
}

// 비밀번호 보기/숨기기
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('pw-mask')) {
    const mask = e.target;
    if (mask.dataset.visible === 'true') {
      mask.textContent = '••••••••';
      mask.dataset.visible = 'false';
    } else {
      // 실제로는 저장된 비밀번호를 표시해야 함
      mask.textContent = '(클릭하여 표시)';
      mask.dataset.visible = 'true';
    }
  }
});

// 모달 외부 클릭 시 닫기
document.getElementById('stackModal')?.addEventListener('click', function(e) {
  if (e.target === this) {
    closeStackModal();
  }
});

// ESC 키로 모달 닫기
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeStackModal();
  }
});
