<?php
/**
 * 전 채널 식별자 ↔ 테이블/라벨 매핑.
 * SQL 인젝션 방지 화이트리스트로 사용한다.
 *
 * - 네이버쇼핑은 전용 페이지/Ajax가 따로 있지만,
 *   엑셀 핸들러·대시보드 등은 공통 맵에서 참조한다.
 */

if (!isset($GLOBALS['CHANNEL_MAP'])) {
    $GLOBALS['CHANNEL_MAP'] = [
        'naver'  => ['table' => 'naver_shopping_work', 'label' => '네이버쇼핑'],
        'place'  => ['table' => 'place_work',          'label' => '플레이스'],
        'inflow' => ['table' => 'inflow_work',         'label' => '유입플'],
        'blog'   => ['table' => 'blog_work',           'label' => '블로그'],
        'ohouse' => ['table' => 'ohouse_work',         'label' => '오늘의집'],
        'kakao'  => ['table' => 'kakao_work',          'label' => '카카오맵'],
        'auto'   => ['table' => 'auto_work',           'label' => '자동완성'],
    ];
}

function channel_table($key) {
    return $GLOBALS['CHANNEL_MAP'][$key]['table'] ?? null;
}

function channel_label($key) {
    return $GLOBALS['CHANNEL_MAP'][$key]['label'] ?? $key;
}

function channel_valid($key) {
    return isset($GLOBALS['CHANNEL_MAP'][$key]);
}
