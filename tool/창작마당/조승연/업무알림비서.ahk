#Requires AutoHotkey v2.0
#SingleInstance Force
Persistent

global APP_NAME := "오늘비서 - 업무 알림"
global DATA_DIR := A_AppData "\\WorkReminderAssistant"
global DATA_FILE := DATA_DIR "\\tasks.tsv"
global STARTUP_LINK := A_Startup "\\오늘비서 업무알림.lnk"
global Tasks := []
global MainGui := 0
global TaskList := 0
global BulkInput := 0
global StatusText := 0
global AlertGui := 0
global AlertTask := 0
global AlertQueue := []
global EditingId := ""
global HideCompleted := true

DirCreate(DATA_DIR)
LoadTasks()
BuildMainGui()
BuildTrayMenu()
EnsureStartupShortcut()
SetTimer(CheckDueTasks, 5000)
CheckDueTasks()
MainGui.Show("w1060 h720")

BuildTrayMenu() {
    global APP_NAME
    A_TrayMenu.Delete()
    A_TrayMenu.Add("오늘비서 열기", (*) => ShowMain())
    A_TrayMenu.Add("마감된 알림 확인", (*) => CheckDueTasks())
    A_TrayMenu.Add()
    A_TrayMenu.Add("프로그램 종료", (*) => ExitApp())
    A_TrayMenu.Default := "오늘비서 열기"
    A_TrayMenu.ClickCount := 1
    A_IconTip := APP_NAME "`n화면을 닫아도 알림은 계속 실행됩니다."
}

BuildMainGui() {
    global MainGui, TaskList, BulkInput, StatusText, APP_NAME, STARTUP_LINK
    MainGui := Gui("+Resize MinSize900x620", APP_NAME)
    MainGui.BackColor := "F7F4ED"
    MainGui.SetFont("s10", "Malgun Gothic")
    MainGui.OnEvent("Close", HideMain)
    MainGui.OnEvent("Escape", HideMain)

    MainGui.SetFont("s20 bold c17324D")
    MainGui.AddText("x28 y22 w600 h40", "오늘비서")
    MainGui.SetFont("s10 norm c526270")
    MainGui.AddText("x30 y62 w900 h24", "업무를 붙여넣어 등록하고, 알림은 컴퓨터가 직접 챙깁니다.")

    MainGui.SetFont("s11 bold c17324D")
    MainGui.AddText("x28 y104 w470 h26", "자연어 한꺼번에 등록")
    MainGui.SetFont("s9 norm c526270")
    MainGui.AddText("x28 y132 w485 h38", "일반 문장 또는 '번호 / 알림 문장'을 한 줄씩 붙여넣으세요.")
    BulkInput := MainGui.AddEdit("x28 y174 w490 h240 +Multi +WantTab -Wrap")
    BulkInput.SetFont("s10", "Malgun Gothic")
    MainGui.AddButton("x28 y426 w156 h40 Default", "일정 분석 및 등록").OnEvent("Click", RegisterBulk)
    MainGui.AddButton("x194 y426 w102 h40", "입력 지우기").OnEvent("Click", (*) => BulkInput.Value := "")
    MainGui.AddButton("x306 y426 w102 h40", "직접 등록").OnEvent("Click", (*) => OpenTaskEditor())
    MainGui.AddButton("x418 y426 w100 h40", "예시 입력").OnEvent("Click", FillExample)

    MainGui.SetFont("s11 bold c17324D")
    MainGui.AddText("x545 y104 w480 h26", "등록된 알림")
    MainGui.SetFont("s9 norm c526270")
    MainGui.AddText("x545 y132 w480 h38", "확인 전까지 유지되며, 보류 시 재알림 시간을 지정합니다.")
    TaskList := MainGui.AddListView("x545 y174 w485 h388 Grid -Multi", ["상태", "알림 시각", "구분", "업무 내용", "ID"])
    TaskList.ModifyCol(1, 58)
    TaskList.ModifyCol(2, 132)
    TaskList.ModifyCol(3, 120)
    TaskList.ModifyCol(4, 300)
    TaskList.ModifyCol(5, 0)
    TaskList.OnEvent("DoubleClick", EditSelected)
    MainGui.AddButton("x545 y574 w100 h38", "수정").OnEvent("Click", EditSelected)
    MainGui.AddButton("x655 y574 w100 h38", "삭제").OnEvent("Click", DeleteSelected)
    MainGui.AddButton("x765 y574 w126 h38", "완료 항목 숨김").OnEvent("Click", ToggleCompleted)
    MainGui.AddButton("x901 y574 w129 h38", "알림 지금 확인").OnEvent("Click", (*) => CheckDueTasks(true))

    MainGui.SetFont("s9 norm c347D78")
    StatusText := MainGui.AddText("x28 y490 w490 h72", "화면의 X를 눌러도 프로그램은 종료되지 않고 작업표시줄 우측에서 계속 실행됩니다.")
    MainGui.SetFont("s9 norm c526270")
    auto := MainGui.AddCheckbox("x28 y576 w350 h28", "윈도우 시작 시 자동 실행")
    auto.Value := FileExist(STARTUP_LINK) ? 1 : 0
    auto.OnEvent("Click", ToggleStartup)
    MainGui.AddText("x28 y616 w490 h58", "알림창의 확인을 누르면 종료됩니다. 보류를 누르면 10분·30분·1시간 또는 원하는 날짜와 시간을 다시 지정할 수 있습니다.")

    RefreshTaskList()
}

ShowMain() {
    global MainGui
    MainGui.Show()
    WinActivate(MainGui.Hwnd)
}

HideMain(*) {
    global MainGui
    MainGui.Hide()
    TrayTip("화면만 닫혔습니다. 예약 알림은 계속 실행됩니다.", "오늘비서", 2)
}

FillExample(*) {
    global BulkInput
    BulkInput.Value := "오늘 5시에 알람 보내줘`r`n매주 금요일 4시마다 주마감 알람 보내줘.`r`n매일 오후 5시에 환불 확인 알람 보내줘.`r`n매월 25일 오전 10시에 월마감 알람 보내줘.`r`n`r`n■ 교환 제품 회수 확인`r`n2025110552174031 / 다음주 금요일 오후 4:00시에 확인 알림 보내줘.`r`n3291038030 / 3일뒤에 오후 4시에 알림 보내줘."
}

RegisterBulk(*) {
    global BulkInput, APP_NAME
    text := Trim(BulkInput.Value)
    if !text {
        MsgBox("등록할 내용을 입력해 주세요.", APP_NAME, "Icon!")
        return
    }
    section := "일반 업무"
    added := 0
    errors := []
    for line in StrSplit(StrReplace(text, "`r"), "`n") {
        line := Trim(line)
        if !line
            continue
        if RegExMatch(line, "^■\s*(.+)$", &m) {
            section := Trim(m[1])
            continue
        }
        if InStr(line, "/") {
            parts := StrSplit(line, "/",, 2)
            ref := Trim(parts[1])
            command := Trim(parts[2])
        } else {
            command := line
            ref := InferTitle(command)
        }
        due := ParseNaturalDateTime(command)
        if !due {
            errors.Push(ref " : 날짜/시간을 확인해 주세요.")
            continue
        }
        title := ref
        if InStr(command, "구매확정") && !InStr(section, "구매확정")
            sectionName := "구매확정"
        else
            sectionName := section
        AddTask(sectionName, title, command, due, GetRepeatRule(command))
        added += 1
    }
    SaveTasks()
    RefreshTaskList()
    if added
        BulkInput.Value := ""
    msg := added "건의 알림을 등록했습니다."
    if errors.Length {
        msg .= "`n`n등록하지 못한 항목:`n" Join(errors, "`n")
    }
    MsgBox(msg, APP_NAME, errors.Length ? "Icon!" : "Iconi")
}

ParseNaturalDateTime(text) {
    now := A_Now
    relativeMinutes := GetRelativeMinutes(text)
    if relativeMinutes > 0
        return DateAdd(now, relativeMinutes, "Minutes")

    dayOffset := GetRelativeDayOffset(text)
    hasClock := RegExMatch(text, "(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분|\s*:\s*(\d{1,2}))?", &t)
    if !hasClock {
        if dayOffset >= 0
            return DateAdd(now, dayOffset, "Days")
        return ""
    }
    ampm := t[1]
    hour := Integer(t[2])
    minute := t[3] != "" ? Integer(t[3]) : (t[4] != "" ? Integer(t[4]) : 0)
    if ampm = "" && hour >= 1 && hour <= 7
        hour += 12
    if ampm = "오후" && hour < 12
        hour += 12
    if ampm = "오전" && hour = 12
        hour := 0
    if hour > 23 || minute > 59
        return ""

    datePart := ""
    if RegExMatch(text, "(\d{4})[.-](\d{1,2})[.-](\d{1,2})", &m) {
        datePart := Format("{:04}{:02}{:02}", Integer(m[1]), Integer(m[2]), Integer(m[3]))
    } else if RegExMatch(text, "(\d{1,2})월\s*(\d{1,2})일", &m) {
        year := Integer(SubStr(now, 1, 4))
        candidate := Format("{:04}{:02}{:02}", year, Integer(m[1]), Integer(m[2]))
        if DateDiff(candidate "000000", now, "Days") < -1
            candidate := Format("{:04}{:02}{:02}", year + 1, Integer(m[1]), Integer(m[2]))
        datePart := candidate
    } else if InStr(text, "오늘") {
        datePart := SubStr(now, 1, 8)
    } else if InStr(text, "내일") {
        datePart := SubStr(DateAdd(SubStr(now, 1, 8) "000000", 1, "Days"), 1, 8)
    } else if dayOffset >= 0 {
        datePart := SubStr(DateAdd(SubStr(now, 1, 8) "000000", dayOffset, "Days"), 1, 8)
    } else if InStr(text, "매일") {
        datePart := SubStr(now, 1, 8)
    } else if RegExMatch(text, "다음\s*주\s*(월|화|수|목|금|토|일)요일", &m) {
        target := Map("일",1,"월",2,"화",3,"수",4,"목",5,"금",6,"토",7)[m[1]]
        todayDow := Integer(FormatTime(now, "WDay"))
        daysToNextMonday := Mod(9 - todayDow, 7)
        if daysToNextMonday = 0
            daysToNextMonday := 7
        offset := daysToNextMonday + Mod(target - 2, 7)
        datePart := SubStr(DateAdd(SubStr(now, 1, 8) "000000", offset, "Days"), 1, 8)
    } else if RegExMatch(text, "매주\s*(월|화|수|목|금|토|일)요일", &m) {
        target := Map("일",1,"월",2,"화",3,"수",4,"목",5,"금",6,"토",7)[m[1]]
        todayDow := Integer(FormatTime(now, "WDay"))
        offset := Mod(target - todayDow + 7, 7)
        datePart := SubStr(DateAdd(SubStr(now, 1, 8) "000000", offset, "Days"), 1, 8)
    } else if RegExMatch(text, "매월\s*(\d{1,2})일", &m) {
        return NextMonthlyDue(Integer(m[1]), hour, minute, now)
    } else if RegExMatch(text, "(월|화|수|목|금|토|일)요일", &m) {
        target := Map("일",1,"월",2,"화",3,"수",4,"목",5,"금",6,"토",7)[m[1]]
        todayDow := Integer(FormatTime(now, "WDay"))
        offset := Mod(target - todayDow + 7, 7)
        if offset = 0
            offset := 7
        datePart := SubStr(DateAdd(SubStr(now, 1, 8) "000000", offset, "Days"), 1, 8)
    } else {
        return ""
    }

    due := datePart Format("{:02}{:02}00", hour, minute)
    if (InStr(text, "매일") || InStr(text, "매주")) && due <= now
        due := DateAdd(due, InStr(text, "매일") ? 1 : 7, "Days")
    return due
}

GetRelativeMinutes(text) {
    if RegExMatch(text, "(\d+|[일이삼사오육칠팔구십]+)\s*분\s*뒤", &m)
        return KoreanNumberToInt(m[1])
    if RegExMatch(text, "(\d+|[일이삼사오육칠팔구십]+)\s*시간\s*뒤", &m)
        return KoreanNumberToInt(m[1]) * 60
    if RegExMatch(text, "(한|두|세|네)\s*시간\s*뒤", &m)
        return Map("한",1,"두",2,"세",3,"네",4)[m[1]] * 60
    return 0
}

GetRelativeDayOffset(text) {
    nativeDays := Map("하루",1, "이틀",2, "사흘",3, "나흘",4, "닷새",5, "엿새",6, "이레",7, "여드레",8, "아흐레",9)
    if RegExMatch(text, "(하루|이틀|사흘|나흘|닷새|엿새|이레|여드레|아흐레)\s*뒤", &m)
        return nativeDays[m[1]]
    if RegExMatch(text, "(\d+|[일이삼사오육칠팔구십]+)\s*일\s*뒤", &m)
        return KoreanNumberToInt(m[1])
    return -1
}

KoreanNumberToInt(value) {
    if RegExMatch(value, "^\d+$")
        return Integer(value)
    nums := Map("일",1,"이",2,"삼",3,"사",4,"오",5,"육",6,"칠",7,"팔",8,"구",9)
    if value = "십"
        return 10
    if InStr(value, "십") {
        parts := StrSplit(value, "십")
        tens := parts[1] = "" ? 1 : (nums.Has(parts[1]) ? nums[parts[1]] : 0)
        ones := parts.Length < 2 || parts[2] = "" ? 0 : (nums.Has(parts[2]) ? nums[parts[2]] : 0)
        return tens * 10 + ones
    }
    return nums.Has(value) ? nums[value] : 0
}

GetRepeatRule(text) {
    if InStr(text, "매일")
        return "daily"
    if RegExMatch(text, "매주\s*(월|화|수|목|금|토|일)요일")
        return "weekly"
    if RegExMatch(text, "매월\s*(\d{1,2})일", &m)
        return "monthly:" m[1]
    return ""
}

InferTitle(text) {
    title := text
    title := RegExReplace(title, "(오늘|내일|(하루|이틀|사흘|나흘|닷새|엿새|이레|여드레|아흐레)\s*뒤|(\d+|[일이삼사오육칠팔구십]+)\s*(분|시간|일)\s*뒤|다음\s*주\s*[월화수목금토일]요일|매일|매주\s*[월화수목금토일]요일|매월\s*\d{1,2}일)", " ")
    title := RegExReplace(title, "(오전|오후)?\s*\d{1,2}\s*시(?:\s*\d{1,2}\s*분|\s*:\s*\d{1,2})?(?:에|마다)?", " ")
    title := RegExReplace(title, "(확인\s*)?(알람|알림)\s*(보내\s*줘|해\s*줘|줘)?", " ")
    title := RegExReplace(title, "[.。!]+", " ")
    title := RegExReplace(title, "(^|\s)(에|마다)(?=\s|$)", " ")
    title := Trim(RegExReplace(title, "\s+", " "))
    return title != "" ? title : "일반 알림"
}

NextMonthlyDue(day, hour, minute, afterTime) {
    year := Integer(SubStr(afterTime, 1, 4))
    month := Integer(SubStr(afterTime, 5, 2))
    Loop 14 {
        candidate := Format("{:04}{:02}{:02}{:02}{:02}00", year, month, day, hour, minute)
        try {
            FormatTime(candidate, "yyyyMMdd")
            if candidate > afterTime
                return candidate
        }
        month += 1
        if month > 12 {
            month := 1
            year += 1
        }
    }
    return ""
}

AddTask(category, title, note, due, repeat := "") {
    global Tasks
    Tasks.Push(Map(
        "id", FormatTime(, "yyyyMMddHHmmss") "-" Random(1000,9999),
        "category", CleanField(category),
        "title", CleanField(title),
        "note", CleanField(note),
        "due", due,
        "repeat", repeat,
        "status", "대기",
        "created", A_Now
    ))
}

OpenTaskEditor(taskId := "") {
    global EditingId, MainGui
    EditingId := taskId
    task := taskId ? FindTask(taskId) : 0
    g := Gui("+Owner" MainGui.Hwnd, task ? "알림 수정" : "알림 직접 등록")
    g.SetFont("s10", "Malgun Gothic")
    g.AddText("x20 y20 w110", "구분")
    cat := g.AddEdit("x140 y16 w310", task ? task["category"] : "일반 업무")
    g.AddText("x20 y62 w110", "업무 내용")
    title := g.AddEdit("x140 y58 w310", task ? task["title"] : "")
    g.AddText("x20 y104 w110", "알림 날짜")
    date := g.AddDateTime("x140 y100 w150 Choose" (task ? SubStr(task["due"],1,8) : SubStr(A_Now,1,8)), "yyyy-MM-dd")
    g.AddText("x20 y146 w110", "알림 시간")
    time := g.AddDateTime("x140 y142 w150 Choose" (task ? task["due"] : A_Now), "Time")
    g.AddText("x20 y188 w110", "메모")
    note := g.AddEdit("x140 y184 w310 h84 +Multi", task ? task["note"] : "")
    saveBtn := g.AddButton("x140 y288 w145 h40 Default", task ? "수정 저장" : "업무 등록")
    g.AddButton("x305 y288 w145 h40", "취소").OnEvent("Click", (*) => g.Destroy())
    saveBtn.OnEvent("Click", SaveEditor.Bind(g, cat, title, date, time, note, taskId))
    g.Show("w475 h350")
}

SaveEditor(g, cat, title, date, time, note, taskId, *) {
    global APP_NAME
    if !Trim(title.Value) {
        MsgBox("업무 내용을 입력해 주세요.", APP_NAME, "Icon!")
        return
    }
    due := FormatTime(date.Value, "yyyyMMdd") FormatTime(time.Value, "HHmm") "00"
    if taskId {
        task := FindTask(taskId)
        task["category"] := CleanField(cat.Value)
        task["title"] := CleanField(title.Value)
        task["note"] := CleanField(note.Value)
        task["due"] := due
        task["status"] := "대기"
    } else {
        AddTask(cat.Value, title.Value, note.Value, due)
    }
    SaveTasks()
    RefreshTaskList()
    g.Destroy()
}

EditSelected(*) {
    global TaskList, APP_NAME
    row := TaskList.GetNext()
    if !row {
        MsgBox("수정할 업무를 선택해 주세요.", APP_NAME, "Icon!")
        return
    }
    OpenTaskEditor(TaskList.GetText(row, 5))
}

DeleteSelected(*) {
    global TaskList, Tasks, APP_NAME
    row := TaskList.GetNext()
    if !row {
        MsgBox("삭제할 업무를 선택해 주세요.", APP_NAME, "Icon!")
        return
    }
    id := TaskList.GetText(row, 5)
    if MsgBox("선택한 알림을 삭제할까요?", APP_NAME, "YesNo Icon?") != "Yes"
        return
    for i, task in Tasks {
        if task["id"] = id {
            Tasks.RemoveAt(i)
            break
        }
    }
    SaveTasks()
    RefreshTaskList()
}

ToggleCompleted(btn, *) {
    global HideCompleted
    HideCompleted := !HideCompleted
    btn.Text := HideCompleted ? "완료 항목 숨김" : "완료 항목 표시"
    RefreshTaskList()
}

RefreshTaskList() {
    global TaskList, Tasks, HideCompleted
    if !IsObject(TaskList)
        return
    TaskList.Delete()
    for task in Tasks {
        if HideCompleted && task["status"] = "완료"
            continue
        status := task["status"] = "완료" ? "완료" : (task["due"] <= A_Now ? "마감" : "대기")
        TaskList.Add(, status, FormatDue(task["due"]), task["category"], task["title"], task["id"])
    }
}

CheckDueTasks(force := false) {
    global AlertQueue, AlertGui, Tasks
    for task in Tasks {
        if task["status"] != "대기"
            continue
        if task["due"] <= A_Now && !QueueHas(task["id"])
            AlertQueue.Push(task["id"])
    }
    RefreshTaskList()
    if !IsObject(AlertGui) && AlertQueue.Length
        ShowNextAlert()
    else if force && !AlertQueue.Length
        TrayTip("현재 마감된 알림이 없습니다.", "오늘비서", 2)
}

QueueHas(id) {
    global AlertQueue, AlertTask
    for queued in AlertQueue
        if queued = id
            return true
    return IsObject(AlertTask) && AlertTask["id"] = id
}

ShowNextAlert() {
    global AlertGui, AlertTask, AlertQueue
    if !AlertQueue.Length {
        AlertGui := 0
        AlertTask := 0
        return
    }
    id := AlertQueue.RemoveAt(1)
    task := FindTask(id)
    if !task || task["status"] != "대기" {
        ShowNextAlert()
        return
    }
    AlertTask := task
    SoundBeep(880, 240)
    SoundBeep(1100, 240)
    AlertGui := Gui("+AlwaysOnTop -MinimizeBox -MaximizeBox", "업무 확인 알림")
    AlertGui.BackColor := "FFFEFA"
    AlertGui.SetFont("s10", "Malgun Gothic")
    AlertGui.OnEvent("Close", (*) => 0)
    AlertGui.OnEvent("Escape", (*) => 0)
    AlertGui.SetFont("s14 bold c17324D")
    AlertGui.AddText("x28 y24 w500 h34", task["category"])
    AlertGui.SetFont("s18 bold c17324D")
    AlertGui.AddText("x28 y72 w500 h56", task["title"])
    AlertGui.SetFont("s10 norm c526270")
    AlertGui.AddText("x28 y140 w500 h28", "예약 시각  " FormatDue(task["due"]))
    if task["note"]
        AlertGui.AddEdit("x28 y182 w500 h92 ReadOnly +Multi", task["note"])
    AlertGui.SetFont("s11 bold")
    AlertGui.AddButton("x28 y300 w235 h52 Default", "확인").OnEvent("Click", ConfirmAlert)
    AlertGui.AddButton("x293 y300 w235 h52", "보류").OnEvent("Click", HoldAlert)
    AlertGui.SetFont("s9 norm cA14B3B")
    AlertGui.AddText("x28 y370 w500 h42 Center", "확인 또는 보류를 선택해야 알림창이 닫힙니다.")
    AlertGui.Show("w556 h430 Center")
    WinActivate(AlertGui.Hwnd)
}

ConfirmAlert(*) {
    global AlertGui, AlertTask
    repeat := AlertTask.Has("repeat") ? AlertTask["repeat"] : ""
    if repeat != "" {
        AlertTask["due"] := NextRepeatDue(AlertTask)
        AlertTask["status"] := "대기"
    } else {
        AlertTask["status"] := "완료"
    }
    SaveTasks()
    AlertGui.Destroy()
    AlertGui := 0
    AlertTask := 0
    RefreshTaskList()
    SetTimer(ShowNextAlert, -250)
}

NextRepeatDue(task) {
    repeat := task.Has("repeat") ? task["repeat"] : ""
    due := task["due"]
    if repeat = "daily" {
        while due <= A_Now
            due := DateAdd(due, 1, "Days")
        return due
    }
    if repeat = "weekly" {
        while due <= A_Now
            due := DateAdd(due, 7, "Days")
        return due
    }
    if RegExMatch(repeat, "^monthly:(\d{1,2})$", &m) {
        return NextMonthlyDue(Integer(m[1]), Integer(SubStr(due,9,2)), Integer(SubStr(due,11,2)), A_Now)
    }
    return due
}

HoldAlert(*) {
    global AlertGui, AlertTask
    h := Gui("+Owner" AlertGui.Hwnd " +AlwaysOnTop", "재알림 시간 설정")
    h.SetFont("s10", "Malgun Gothic")
    h.AddText("x20 y18 w390 h28", "보류할 시간을 선택해 주세요.")
    h.AddButton("x20 y58 w90 h38", "10분 뒤").OnEvent("Click", SnoozePreset.Bind(h, 10))
    h.AddButton("x120 y58 w90 h38", "30분 뒤").OnEvent("Click", SnoozePreset.Bind(h, 30))
    h.AddButton("x220 y58 w90 h38", "1시간 뒤").OnEvent("Click", SnoozePreset.Bind(h, 60))
    h.AddButton("x320 y58 w90 h38", "내일 10시").OnEvent("Click", SnoozeTomorrow.Bind(h))
    h.AddText("x20 y120 w100", "직접 지정")
    d := h.AddDateTime("x20 y148 w180 Choose" SubStr(A_Now,1,8), "yyyy-MM-dd")
    t := h.AddDateTime("x220 y148 w120 Choose" A_Now, "Time")
    h.AddButton("x20 y198 w320 h42 Default", "이 시간으로 재알림").OnEvent("Click", SnoozeCustom.Bind(h,d,t))
    h.AddButton("x350 y198 w60 h42", "취소").OnEvent("Click", (*) => h.Destroy())
    h.Show("w430 h265 Center")
}

SnoozePreset(g, minutes, *) {
    FinishSnooze(g, DateAdd(A_Now, minutes, "Minutes"))
}

SnoozeTomorrow(g, *) {
    FinishSnooze(g, SubStr(DateAdd(SubStr(A_Now,1,8) "000000", 1, "Days"),1,8) "100000")
}

SnoozeCustom(g, d, t, *) {
    global APP_NAME
    due := FormatTime(d.Value, "yyyyMMdd") FormatTime(t.Value, "HHmm") "00"
    if due <= A_Now {
        MsgBox("현재보다 이후 시간을 선택해 주세요.", APP_NAME, "Icon!")
        return
    }
    FinishSnooze(g, due)
}

FinishSnooze(g, due) {
    global AlertGui, AlertTask
    AlertTask["due"] := due
    AlertTask["status"] := "대기"
    SaveTasks()
    g.Destroy()
    AlertGui.Destroy()
    AlertGui := 0
    AlertTask := 0
    RefreshTaskList()
    SetTimer(ShowNextAlert, -250)
}

ToggleStartup(ctrl, *) {
    global STARTUP_LINK, APP_NAME
    if ctrl.Value {
        try FileCreateShortcut(A_ScriptFullPath, STARTUP_LINK, A_ScriptDir)
        catch as err {
            ctrl.Value := 0
            MsgBox("자동 실행을 설정하지 못했습니다.`n" err.Message, APP_NAME, "Icon!")
        }
    } else if FileExist(STARTUP_LINK) {
        FileDelete(STARTUP_LINK)
    }
}

EnsureStartupShortcut() {
    global STARTUP_LINK
    if !FileExist(STARTUP_LINK)
        try FileCreateShortcut(A_ScriptFullPath, STARTUP_LINK, A_ScriptDir)
}

LoadTasks() {
    global Tasks, DATA_FILE
    Tasks := []
    if !FileExist(DATA_FILE)
        return
    content := FileRead(DATA_FILE, "UTF-8")
    for line in StrSplit(StrReplace(content, "`r"), "`n") {
        if !Trim(line)
            continue
        f := StrSplit(line, "`t")
        if f.Length < 7
            continue
        repeat := f.Length >= 8 ? f[8] : ""
        Tasks.Push(Map("id",f[1], "category",f[2], "title",f[3], "note",f[4], "due",f[5], "status",f[6], "created",f[7], "repeat",repeat))
    }
}

SaveTasks() {
    global Tasks, DATA_FILE
    out := ""
    for task in Tasks {
        repeat := task.Has("repeat") ? task["repeat"] : ""
        out .= CleanField(task["id"]) "`t" CleanField(task["category"]) "`t" CleanField(task["title"]) "`t" CleanField(task["note"]) "`t" task["due"] "`t" task["status"] "`t" task["created"] "`t" repeat "`n"
    }
    if FileExist(DATA_FILE)
        FileDelete(DATA_FILE)
    FileAppend(out, DATA_FILE, "UTF-8")
}

FindTask(id) {
    global Tasks
    for task in Tasks
        if task["id"] = id
            return task
    return 0
}

CleanField(value) {
    return StrReplace(StrReplace(StrReplace(Trim(value), "`t", " "), "`r", " "), "`n", " ")
}

FormatDue(due) {
    try return FormatTime(due, "yyyy-MM-dd (ddd) tt h:mm")
    catch
        return due
}

Join(items, sep) {
    out := ""
    for i, item in items
        out .= (i > 1 ? sep : "") item
    return out
}
