/* CONTROL Admin 공통 JS */

$(function () {
    // flatpickr 한국어 로케일 적용 (모든 .datepicker 인풋)
    if (window.flatpickr) {
        flatpickr.localize(flatpickr.l10ns.ko);
        flatpickr('.datepicker', {
            dateFormat: 'Y-m-d',
            allowInput: true,
        });
    }

    // 전체 체크박스 토글
    $(document).on('change', '.check-all', function () {
        const checked = $(this).prop('checked');
        $('input[name="check_idx[]"]').prop('checked', checked);
    });

    // 간편 조회 버튼
    $(document).on('click', '.btn-date-shortcut', function () {
        const shortcut = $(this).data('shortcut');
        const frm = $(this).closest('form');
        frm.find('input[name="pass_shortcut"]').val(shortcut);
        frm.submit();
    });
});

/**
 * 일괄 상태 변경 확인/제출
 * @param {string} mode  - etc_date_act / refund_req / delete_req / move_working 등
 * @param {string} label - 확인 메시지에 표시할 라벨 (예: "10일 연장")
 */
function Submit_Check(mode, label) {
    const $form = $('form[name="check_form2"]');
    const checked = $form.find('input[name="check_idx[]"]:checked');
    if (checked.length === 0) {
        alert('항목을 선택해주세요.');
        return false;
    }
    if (!confirm('선택한 ' + checked.length + '건을 [' + label + '] 처리하시겠습니까?')) {
        return false;
    }
    $form.find('input[name="mode"]').val(mode);
    $form.submit();
    return true;
}

/**
 * 상품 상세 편집 모달 로드
 */
function modalpop(idx, return_url) {
    $.ajax({
        url: '/crm_admin/ajax/naver.info.ajax.php',
        type: 'POST',
        data: { idx: idx, return_url: return_url },
        success: function (html) {
            $('#modalEditBody').html(html);
            $('#showModalEdit').modal('show');
        },
        error: function () {
            alert('상세 정보를 불러오지 못했습니다.');
        },
    });
}

/**
 * 순위 이력 팝업 (전 채널 통합)
 * @param {string} channel - naver/place/inflow/blog/ohouse/kakao/auto
 * @param {number} idx     - 작업 idx
 * @param {string} keyword - 표시용 키워드
 */
function rank_popup(channel, idx, keyword) {
    // 하위 호환: 인자 2개(idx, keyword)로 호출되면 naver 로 간주
    if (arguments.length === 2) {
        keyword = idx;
        idx = channel;
        channel = 'naver';
    }
    const url = '/crm_admin/ajax/channel.rank.ajax.php'
              + '?channel=' + encodeURIComponent(channel)
              + '&work_idx=' + encodeURIComponent(idx)
              + '&keyword=' + encodeURIComponent(keyword);
    window.open(url, 'rank_popup_' + channel + '_' + idx, 'width=820,height=600,scrollbars=yes,resizable=yes');
}

/**
 * 네이버쇼핑 자동 순위 조회 — 행의 "조회" 버튼에서 호출
 *  btn: 클릭한 button 요소 (로딩 표시 + 결과 적용용)
 */
function naver_rank_fetch(work_idx, btn) {
    const $btn  = $(btn);
    const $cell = $btn.closest('td').find('.rank-current-cell');
    const orig  = $btn.text();
    $btn.prop('disabled', true).text('조회중…');
    $.ajax({
        url: '/crm_admin/ajax/naver.rank.fetch.ajax.php',
        type: 'POST',
        data: { work_idx: work_idx },
        dataType: 'json',
        success: function (res) {
            if (res.result === 'ok') {
                $cell.text(res.rank !== null && res.rank !== undefined ? res.rank : '-');
                $btn.removeClass('btn-link text-danger').addClass('text-success').text('완료');
                if (res.rank === null) alert('미발견: ' + (res.msg || ''));
            } else {
                $btn.removeClass('btn-link').addClass('text-danger').text('실패');
                alert('순위 조회 실패: ' + (res.msg || '알 수 없는 오류'));
            }
        },
        error: function (xhr) {
            $btn.removeClass('btn-link').addClass('text-danger').text('실패');
            alert('네트워크 오류: ' + xhr.status);
        },
        complete: function () {
            setTimeout(function () { $btn.prop('disabled', false).text(orig); }, 2500);
        },
    });
}

/**
 * 대행사 선택 변경 시 셀러 셀렉트 동적 로드
 * placeholder: 첫 옵션 라벨 ('전체' / '선택' 등). 미지정 시 '전체'.
 */
function agency_list(maketer, agency_idx, target_select_id, placeholder) {
    $.ajax({
        url: '/crm_admin/ajax/keyword.upso.list.php',
        type: 'GET',
        data: { maketer: maketer, agencys: agency_idx },
        dataType: 'json',
        success: function (rows) {
            const $sel = $('#' + target_select_id);
            $sel.empty().append($('<option>').val('').text(placeholder || '전체'));
            $.each(rows, function (_, row) {
                const manager = row.admin_name || row.manager_name;
                const label = row.name + (manager ? ' (' + manager + ')' : '');
                $sel.append($('<option>').val(row.id).text(label));
            });
        },
    });
}

/**
 * 로딩 오버레이
 */
function showLoading(msg) {
    let $el = $('#loadingOverlay');
    if ($el.length === 0) {
        $el = $('<div id="loadingOverlay" class="loading-overlay"></div>').appendTo('body');
    }
    $el.text(msg || '처리 중입니다...').addClass('show');
}
function hideLoading() {
    $('#loadingOverlay').removeClass('show');
}
